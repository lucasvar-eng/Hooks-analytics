const MetaCampaign = require('../models/MetaCampaign');
const MetaDailyInsight = require('../models/MetaDailyInsight');
const { recalculateDailyMetric } = require('./metricCalculator');
const logger = require('../utils/logger');

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
async function importMetaCSV(rows, storeId) {
  if (!rows || rows.length < 2) {
    return { imported: 0, errors: ['CSV is empty or has no data rows'] };
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);
  let imported = 0;
  const errors = [];
  const affectedDates = new Set();
  const seenCampaigns = new Map();

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
        { storeId, metaId, date },
        {
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

  logger.info(`Meta CSV imported for store ${storeId}: ${imported} rows, ${errors.length} errors`);

  return { imported, errors };
}

module.exports = { importMetaCSV };
