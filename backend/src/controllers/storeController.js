const Store = require('../models/Store');
const Order = require('../models/Order');
const DailyMetric = require('../models/DailyMetric');
const { aggregateRange } = require('../services/metricCalculator');
const { syncOrders, syncProducts } = require('../services/syncTiendanube');

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
    const store = await Store.create({ nombre, tnStoreId, tnAccessToken });
    res.status(201).json(store);
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
