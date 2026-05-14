const Alert = require('../models/Alert');
const Store = require('../models/Store');
const { runDiagnostics } = require('../services/diagnosticsService');
const mongoose = require('mongoose');

exports.list = async (req, res, next) => {
  try {
    const filter = { storeId: req.params.id };
    if (req.query.estado) filter.estado = req.query.estado;

    const alerts = await Alert.find(filter)
      .sort({ fechaDetectada: -1 })
      .limit(50)
      .lean();

    res.json(alerts);
  } catch (error) {
    next(error);
  }
};

exports.listAllActiveCounts = async (req, res, next) => {
  try {
    const counts = await Alert.aggregate([
      { $match: { estado: 'active' } },
      { $group: { _id: '$storeId', count: { $sum: 1 } } },
    ]);

    const result = {};
    for (const c of counts) {
      result[c._id.toString()] = c.count;
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.acknowledge = async (req, res, next) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.alertId, storeId: req.params.id },
      { estado: 'acknowledged' },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json(alert);
  } catch (error) {
    next(error);
  }
};

exports.resolve = async (req, res, next) => {
  try {
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.alertId, storeId: req.params.id },
      { estado: 'resolved', resolvedAt: new Date() },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json(alert);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/stores/:id/alerts/run — dispara diagnostics on-demand.
 * Útil para no esperar 6h al próximo cron.
 */
exports.runDiagnosticsNow = async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const result = await runDiagnostics(store);
    res.json({
      ok: true,
      created: result?.created || 0,
      detected: result?.total || 0,
      hasKpis: !!(store.objetivos?.kpis && Object.values(store.objetivos.kpis).some((v) => v != null && v !== 0)),
    });
  } catch (error) {
    next(error);
  }
};
