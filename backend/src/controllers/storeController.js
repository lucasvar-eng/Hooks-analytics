const Store = require('../models/Store');
const User = require('../models/User');
const Order = require('../models/Order');
const DailyMetric = require('../models/DailyMetric');
const MetaDailyInsight = require('../models/MetaDailyInsight');
const { aggregateRange } = require('../services/metricCalculator');
const { syncOrders, syncProducts } = require('../services/syncTiendanube');
const { analyze } = require('../services/aiService');
const { DEFAULT_THRESHOLDS } = require('../services/verdictEngine');

exports.list = async (req, res, next) => {
  try {
    const filter =
      req.user.role === 'admin'
        ? {}
        : { _id: { $in: req.user.storeAccess } };

    const stores = await Store.find(filter).select(
      'nombre tnNombre integrationStatus metricasHome objetivos createdAt'
    );
    res.json(stores);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { nombre, tnStoreId, tnAccessToken } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    const store = await Store.create({ nombre: nombre.trim(), tnStoreId, tnAccessToken });

    // Add store to creator's storeAccess
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { storeAccess: store._id },
    });

    res.status(201).json(store);
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const store = await Store.findByIdAndDelete(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json({ message: 'Tienda eliminada' });
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json(store);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const store = await Store.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json(store);
  } catch (error) {
    next(error);
  }
};

exports.getMetrics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'from and to query params required' });
    }

    const current = await aggregateRange(id, from, to);

    // Calculate previous period (same duration, immediately before)
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const durationMs = toDate - fromDate;
    const prevTo = new Date(fromDate.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - durationMs);

    const previous = await aggregateRange(
      id,
      prevFrom.toISOString(),
      prevTo.toISOString()
    );

    // Calculate deltas
    const deltas = {};
    for (const key of Object.keys(current)) {
      if (key === '_id') continue;
      const cur = current[key] || 0;
      const prev = previous[key] || 0;
      deltas[key] = prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : 0;
    }

    res.json({ current, previous, deltas });
  } catch (error) {
    next(error);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50, from, to } = req.query;

    const filter = { storeId: id };
    if (from && to) {
      filter.fechaCreacion = { $gte: new Date(from), $lte: new Date(to) };
    }

    const orders = await Order.find(filter)
      .sort({ fechaCreacion: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Order.countDocuments(filter);

    res.json({ orders, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

exports.syncNow = async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    if (!store.tnAccessToken || !store.tnStoreId) {
      return res.status(400).json({ error: 'TiendaNube not connected' });
    }

    // Run sync in background (don't block the response)
    res.json({ status: 'sync_started' });

    syncOrders(store).catch((err) => {
      console.error('Background sync orders failed:', err.message);
    });
    syncProducts(store).catch((err) => {
      console.error('Background sync products failed:', err.message);
    });
  } catch (error) {
    next(error);
  }
};

exports.getDailyMetrics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    const filter = { storeId: id };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filter.date.$lte = toDate;
      }
    }

    const daily = await DailyMetric.find(filter).sort({ date: 1 }).lean();
    res.json(daily);
  } catch (error) {
    next(error);
  }
};

exports.getOrderDetail = async (req, res, next) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      storeId: req.params.id,
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    next(error);
  }
};

/**
 * Generate ad verdict thresholds using AI based on store's historical data.
 */
exports.generateVerdictThresholds = async (req, res, next) => {
  try {
    const storeId = req.params.id;
    const store = await Store.findById(storeId).select('nombre objetivos');
    if (!store) return res.status(404).json({ error: 'Store not found' });

    // Get last 30 days of ad data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const adData = await MetaDailyInsight.aggregate([
      { $match: { storeId: store._id, date: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: null,
          totalSpend: { $sum: '$spend' },
          totalPurchases: { $sum: '$purchases' },
          totalRevenue: { $sum: '$purchaseValue' },
          totalImpressions: { $sum: '$impressions' },
          totalClicks: { $sum: '$clicks' },
          days: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } },
        },
      },
    ]);

    const summary = adData[0] || {};
    const avgRoas = summary.totalSpend > 0 ? summary.totalRevenue / summary.totalSpend : 0;
    const avgCpa = summary.totalPurchases > 0 ? summary.totalSpend / summary.totalPurchases : 0;
    const daysActive = summary.days?.length || 0;

    // Try AI generation
    try {
      const prompt = `Basándote en estos datos de los últimos 30 días de la tienda "${store.nombre}":
- ROAS promedio: ${avgRoas.toFixed(2)}x
- CPA promedio: $${Math.round(avgCpa)}
- Gasto total: $${Math.round(summary.totalSpend || 0)}
- Compras totales: ${summary.totalPurchases || 0}
- Días activos: ${daysActive}
- Objetivos configurados: ${JSON.stringify(store.objetivos?.kpis || {})}

Generá umbrales personalizados para clasificar campañas. Respondé SOLO con un JSON válido (sin markdown, sin texto extra) con esta estructura exacta:
{"escalar":{"roasMin":number,"minSpend":number,"minPurchases":number},"mantener":{"roasMin":number,"minSpend":number},"revisar":{"roasMin":number,"cpaMaxPct":number},"pausar":{"roasMax":number,"minSpend":number,"minDays":number},"testear":{"maxSpend":number,"maxPurchases":number}}`;

      const result = await analyze('dashboard', storeId, null, null, req.user._id);
      // Try to parse JSON from the response
      const jsonMatch = result.analysis.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const thresholds = JSON.parse(jsonMatch[0]);
        return res.json({ thresholds, source: 'ai' });
      }
    } catch {
      // AI not available, generate rule-based defaults
    }

    // Fallback: generate sensible defaults based on data
    const thresholds = { ...DEFAULT_THRESHOLDS };
    if (avgRoas > 0) {
      thresholds.escalar.roasMin = Math.round(avgRoas * 1.5 * 10) / 10;
      thresholds.mantener.roasMin = Math.round(avgRoas * 0.8 * 10) / 10;
      thresholds.revisar.roasMin = Math.round(avgRoas * 0.5 * 10) / 10;
      thresholds.pausar.roasMax = Math.round(avgRoas * 0.3 * 10) / 10;
    }
    if (avgCpa > 0) {
      thresholds.escalar.minSpend = Math.round(avgCpa * 3);
      thresholds.pausar.minSpend = Math.round(avgCpa * 5);
      thresholds.testear.maxSpend = Math.round(avgCpa * 3);
    }

    res.json({ thresholds, source: 'rule_based' });
  } catch (error) {
    next(error);
  }
};
