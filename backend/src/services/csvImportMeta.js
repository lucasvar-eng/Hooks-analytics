const MetaCampaign = require('../models/MetaCampaign');
const MetaDailyInsight = require('../models/MetaDailyInsight');
const ImportLog = require('../models/ImportLog');
const ImportBatch = require('../models/ImportBatch');
const { recalculateDailyMetric } = require('./metricCalculator');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * Column mappings from Meta Ads Manager CSV export to our schema.
 * Supports both English and Spanish column names.
 */
const COLUMN_MAP = {
  // Campaign/AdSet/Ad identification
  'Campaign name': 'campaignName',
  'Nombre de la campaña': 'campaignName',
  'Campaign ID': 'campaignId',
  'Ad set name': 'adsetName',
  'Nombre del conjunto de anuncios': 'adsetName',
  'Ad set ID': 'adsetId',
  'Ad name': 'adName',
  'Nombre del anuncio': 'adName',
  'Ad ID': 'adId',
  'Day': 'date',
  'Día': 'date',
  'Reporting starts': 'date',
  'Inicio de los informes': 'date',

  // Metrics
  'Amount spent (ARS)': 'spend',
  'Importe gastado (ARS)': 'spend',
  'Amount spent': 'spend',
  'Importe gastado': 'spend',
  'Impressions': 'impressions',
  'Impresiones': 'impressions',
  'Reach': 'reach',
  'Alcance': 'reach',
  'Clicks (all)': 'clicks',
  'Clics (todos)': 'clicks',
  'Link clicks': 'linkClicks',
  'Clics en el enlace': 'linkClicks',
  'CTR (all)': 'ctr',
  'CTR (link click-through rate)': 'ctr',
  'CPC (all)': 'cpc',
  'CPC (cost per link click)': 'cpc',
  'CPM (cost per 1,000 impressions)': 'cpm',
  'CPM': 'cpm',
  'Purchases': 'purchases',
  'Compras': 'purchases',
  'Purchase ROAS (return on ad spend)': 'roas',
  'Website purchases': 'purchases',
  'Compras en el sitio web': 'purchases',
  'Purchase conversion value': 'purchaseValue',
  'Valor de conversión de compras': 'purchaseValue',
  'Cost per purchase': 'costPerPurchase',
  'Costo por compra': 'costPerPurchase',
  'Adds to cart': 'atc',
  'Adiciones al carrito': 'atc',
  'Checkouts initiated': 'checkouts',
  'Procesos de pago iniciados': 'checkouts',
  'Results': 'results',
  'Resultados': 'results',
  'Cost per result': 'costPerResult',
  'Costo por resultado': 'costPerResult',
};

/**
 * Required columns — at least one of these must be present per group.
 */
const REQUIRED_GROUPS = {
  identification: ['campaignName', 'campaignId'],
  date: ['date'],
  metrics: ['spend', 'impressions', 'clicks'],
};

/**
 * Validate CSV headers and return detected + missing columns.
 */
function validateHeaders(headers) {
  const detected = [];
  const mapped = {};

  for (const header of headers) {
    const key = COLUMN_MAP[header.trim()];
    if (key) {
      detected.push(key);
      mapped[header.trim()] = key;
    }
  }

  const missing = [];
  for (const [group, keys] of Object.entries(REQUIRED_GROUPS)) {
    const hasAny = keys.some((k) => detected.includes(k));
    if (!hasAny) missing.push(`${group} (${keys.join(' o ')})`);
  }

  return { detected, missing, isValid: missing.length === 0 };
}

/**
 * Parse a CSV row using the column map.
 */
function mapRow(row, headers) {
  const mapped = {};
  headers.forEach((header, i) => {
    const key = COLUMN_MAP[header.trim()];
    if (key) {
      mapped[key] = row[i]?.trim() || '';
    }
  });
  return mapped;
}

/**
 * Import Meta Ads data from CSV rows.
 * @param {Array} rows - Parsed CSV rows (array of arrays)
 * @param {string} storeId - Store ObjectId
 * @returns {object} { imported, errors }
 */
async function importMetaCSV(rows, storeId, fileName, createdBy) {
  if (!rows || rows.length < 2) {
    return { imported: 0, errors: ['CSV is empty or has no data rows'] };
  }

  const headers = rows[0];
  const { detected, missing, isValid } = validateHeaders(headers);
  if (!isValid) {
    return {
      imported: 0,
      total: rows.length - 1,
      errors: [`Faltan columnas requeridas: ${missing.join(', ')}`],
      dateRange: null,
      columnsDetected: detected,
      columnsMissing: missing,
    };
  }

  const dataRows = rows.slice(1);
  let imported = 0;
  const errors = [];
  const affectedDates = new Set();
  const seenCampaigns = new Map();
  const importBatchId = crypto.randomUUID();
  const batch = await ImportBatch.create({
    storeId,
    type: 'meta_csv',
    source: 'csv',
    sourceFileName: fileName || 'unknown.csv',
    status: 'validated',
    rowsTotal: dataRows.length,
    createdBy,
  });

  for (let i = 0; i < dataRows.length; i++) {
    try {
      const data = mapRow(dataRows[i], headers);

      if (!data.date) continue;

      // Parse date (handle DD/MM/YYYY and YYYY-MM-DD)
      let date;
      if (data.date.includes('/')) {
        const [d, m, y] = data.date.split('/');
        date = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
      } else {
        date = new Date(data.date);
      }
      if (isNaN(date.getTime())) {
        errors.push(`Row ${i + 2}: Invalid date "${data.date}"`);
        continue;
      }
      date.setUTCHours(0, 0, 0, 0);

      // Determine level and metaId
      let level, metaId, parentId, nombre;
      if (data.adId && data.adName) {
        level = 'ad';
        metaId = `csv_${data.adId}`;
        parentId = data.adsetId ? `csv_${data.adsetId}` : null;
        nombre = data.adName;
      } else if (data.adsetId && data.adsetName) {
        level = 'adset';
        metaId = `csv_${data.adsetId}`;
        parentId = data.campaignId ? `csv_${data.campaignId}` : null;
        nombre = data.adsetName;
      } else if (data.campaignId || data.campaignName) {
        level = 'campaign';
        metaId = data.campaignId ? `csv_${data.campaignId}` : `csv_${data.campaignName.replace(/\s/g, '_')}`;
        parentId = null;
        nombre = data.campaignName;
      } else {
        continue;
      }

      // Upsert campaign object (once per unique metaId)
      if (!seenCampaigns.has(metaId)) {
        await MetaCampaign.findOneAndUpdate(
          { storeId, metaId },
          { nombre, level, parentId, status: 'ACTIVE' },
          { upsert: true }
        );
        seenCampaigns.set(metaId, true);
      }

      // Upsert daily insight
      const parseNum = (v) => parseFloat(String(v).replace(/,/g, '')) || 0;

      await MetaDailyInsight.findOneAndUpdate(
        {
          storeId,
          metaId,
          date,
          source: 'csv',
          granularity: level,
        },
        {
          source: 'csv',
          granularity: level,
          importBatchId,
          sourceFileName: fileName || 'unknown.csv',
          spend: parseNum(data.spend),
          impressions: parseNum(data.impressions),
          reach: parseNum(data.reach),
          clicks: parseNum(data.clicks),
          linkClicks: parseNum(data.linkClicks),
          ctr: parseNum(data.ctr),
          cpc: parseNum(data.cpc),
          cpm: parseNum(data.cpm),
          purchases: parseNum(data.purchases),
          purchaseValue: parseNum(data.purchaseValue),
          costPerPurchase: parseNum(data.costPerPurchase),
          atc: parseNum(data.atc),
          checkouts: parseNum(data.checkouts),
        },
        { upsert: true }
      );

      affectedDates.add(date.toISOString().split('T')[0]);
      imported++;
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err.message}`);
    }
  }

  // Recalculate DailyMetrics for affected dates
  for (const dateStr of affectedDates) {
    await recalculateDailyMetric(storeId, new Date(dateStr));
  }

  // Determine date range
  const sortedDates = [...affectedDates].sort();
  const dateRangeFrom = sortedDates[0] ? new Date(sortedDates[0]) : null;
  const dateRangeTo = sortedDates[sortedDates.length - 1] ? new Date(sortedDates[sortedDates.length - 1]) : null;

  // Save import log
  const status = errors.length === 0 ? 'success' : imported > 0 ? 'partial' : 'error';
  await ImportLog.create({
    storeId,
    type: 'meta_csv',
    importBatchId,
    fileName: fileName || 'unknown.csv',
    rowsImported: imported,
    rowsTotal: dataRows.length,
    errors: errors.slice(0, 20),
    dateRangeFrom,
    dateRangeTo,
    columnsDetected: detected,
    columnsMissing: missing,
    status,
  });

  await ImportBatch.findByIdAndUpdate(batch._id, {
    status: status === 'success' ? 'completed' : status === 'partial' ? 'partial' : 'failed',
    rowsAccepted: imported,
    rowsRejected: Math.max(dataRows.length - imported, 0),
    warnings: missing,
    validationErrors: errors.slice(0, 20),
    meta: {
      importBatchId,
      dateRangeFrom,
      dateRangeTo,
      columnsDetected: detected,
      columnsMissing: missing,
    },
  });

  logger.info(`Meta CSV imported for store ${storeId}: ${imported} rows, ${errors.length} errors`);

  return {
    imported,
    total: dataRows.length,
    errors: errors.slice(0, 10),
    dateRange: dateRangeFrom && dateRangeTo ? {
      from: sortedDates[0],
      to: sortedDates[sortedDates.length - 1],
    } : null,
    importBatchId,
    columnsDetected: detected,
    columnsMissing: missing,
  };
}

/**
 * Get import history for a store.
 */
async function getImportHistory(storeId) {
  return ImportLog.find({ storeId, type: 'meta_csv' })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
}

module.exports = { importMetaCSV, validateHeaders, getImportHistory };
