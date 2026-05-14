const Store = require('../models/Store');
const { autoClassifyAds, getCampaignResults, getFrameworkOverview, getCreativePipeline, getCreativeMasterSheet } = require('../services/creativeService');
const { isGoogleSheetsConfigured, normalizeSpreadsheetId, syncMasterSheet, getSpreadsheet } = require('../services/googleSheetsService');
const { getAngleStats, getAllAnalyses } = require('../services/adAnalysisService');

exports.getCreativos = async (req, res) => {
  const { from, to } = req.query;
  const ads = await autoClassifyAds(req.params.id, from, to);
  res.json(ads);
};

exports.getCampaignResults = async (req, res) => {
  const { from, to } = req.query;
  const results = await getCampaignResults(req.params.id, from, to);
  res.json(results);
};

exports.getFrameworkOverview = async (req, res) => {
  const overview = await getFrameworkOverview(req.params.id);
  res.json(overview);
};

exports.getCreativePipeline = async (req, res) => {
  const { from, to } = req.query;
  const pipeline = await getCreativePipeline(req.params.id, from, to);
  res.json(pipeline);
};

exports.getCreativeMasterSheet = async (req, res) => {
  const { from, to } = req.query;
  const masterSheet = await getCreativeMasterSheet(req.params.id, from, to);
  res.json(masterSheet);
};

/**
 * Performance agregada por ángulo (de los ads ya analizados).
 * El análisis se hace desde MCP — este endpoint solo lee resultados cacheados.
 */
exports.getAngles = async (req, res, next) => {
  try {
    const { id: storeId } = req.params;
    const { from, to } = req.query;
    const result = await getAngleStats({ storeId, from, to });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Map de todos los análisis del store: { metaId: AdAnalysis }.
 * Para hidratar el state local del frontend al cargar la página.
 */
exports.getAllAnalyses = async (req, res, next) => {
  try {
    const { id: storeId } = req.params;
    const data = await getAllAnalyses(storeId);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

exports.syncCreativeMasterSheet = async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    if (!isGoogleSheetsConfigured()) {
      return res.status(400).json({ error: 'Google Sheets no está configurado en el servidor' });
    }

    const spreadsheetId = normalizeSpreadsheetId(req.body.spreadsheetId || store.googleSheets?.spreadsheetId);
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Falta configurar el spreadsheetId para esta tienda' });
    }

    const { from, to, brief = null } = req.body || {};
    const masterSheet = await getCreativeMasterSheet(req.params.id, from, to, brief);
    const spreadsheet = await getSpreadsheet(spreadsheetId);
    const syncResult = await syncMasterSheet(spreadsheetId, masterSheet);

    store.googleSheets = {
      ...(store.googleSheets?.toObject?.() || store.googleSheets || {}),
      spreadsheetId,
      creativeMasterEnabled: true,
      lastSync: new Date(),
      lastError: '',
    };
    await store.save();

    res.json({
      success: true,
      spreadsheetId,
      spreadsheetTitle: spreadsheet.properties?.title || '',
      masterSheet,
      syncResult,
    });
  } catch (error) {
    try {
      const store = await Store.findById(req.params.id);
      if (store) {
        store.googleSheets = {
          ...(store.googleSheets?.toObject?.() || store.googleSheets || {}),
          lastError: error.response?.data?.error?.message || error.message || 'Error de sincronización con Google Sheets',
        };
        await store.save();
      }
    } catch {}
    next(error);
  }
};
