const Store = require('../models/Store');
const { recalculateAllOrders } = require('../services/orderFinancials');
const { recalculateDailyMetric } = require('../services/metricCalculator');
const DailyMetric = require('../models/DailyMetric');
const logger = require('../utils/logger');

exports.getSettings = async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id).select(
      'cotizacionDolar tasaIBB feePlataformaPct comisionPagoConfig costosEnvio costosAdicionales objetivos'
    );
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json(store);
  } catch (error) {
    next(error);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const allowedFields = [
      'cotizacionDolar',
      'tasaIBB',
      'feePlataformaPct',
      'comisionPagoConfig',
      'costosEnvio',
      'costosAdicionales',
      'objetivos',
      'metricasHome',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const store = await Store.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json(store);
  } catch (error) {
    next(error);
  }
};

/**
 * Recalculate all order financials + DailyMetrics.
 * Used when financial config changes (tasaIBB, comisiones, etc.)
 */
exports.recalculate = async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    res.json({ status: 'recalculation_started' });

    // Run in background
    (async () => {
      try {
        const processed = await recalculateAllOrders(store);

        // Recalculate all DailyMetrics that exist
        const dailyMetrics = await DailyMetric.find({ storeId: store._id }).select('date');
        for (const dm of dailyMetrics) {
          await recalculateDailyMetric(store._id, dm.date);
        }

        logger.info(`Full recalculation done for ${store.nombre}: ${processed} orders, ${dailyMetrics.length} days`);
      } catch (error) {
        logger.error(`Recalculation failed for ${store.nombre}: ${error.message}`);
      }
    })();
  } catch (error) {
    next(error);
  }
};
