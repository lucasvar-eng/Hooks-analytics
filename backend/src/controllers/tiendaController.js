const {
  getTiendaBreakdown,
  getDataAudit,
  getSyncStatus,
  reconcileHistoricalData,
  rebuildStoreHistory,
} = require('../services/tiendaService');

exports.getBreakdown = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const data = await getTiendaBreakdown(req.params.id, from, to);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

exports.getAudit = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const data = await getDataAudit(req.params.id, from, to);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

exports.getSyncStatus = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const data = await getSyncStatus(req.params.id, from, to);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

exports.reconcile = async (req, res, next) => {
  try {
    const { from, to } = req.body;
    const data = await reconcileHistoricalData(req.params.id, from, to);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

exports.rebuildHistory = async (req, res, next) => {
  try {
    const data = await rebuildStoreHistory(req.params.id);
    res.json(data);
  } catch (error) {
    next(error);
  }
};
