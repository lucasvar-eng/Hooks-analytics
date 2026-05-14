const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { getProductsWithMetrics, getProductProfile, simulateProduct, getStockAlerts, getProductOverview, getCommercialOverview, getMonthlyMatrix } = require('../services/productService');
const { buildBusinessSourceDateMatch } = require('../utils/businessDate');

exports.list = async (req, res) => {
  const { from, to, page = 1, limit = 50 } = req.query;
  const result = await getProductsWithMetrics(req.params.id, from, to, +page, +limit);
  res.json(result);
};

exports.profile = async (req, res) => {
  const product = await getProductProfile(req.params.id, req.params.productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
};

exports.simulate = async (req, res) => {
  const product = await Product.findOne({ storeId: req.params.id, _id: req.params.productId }).lean();
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const result = simulateProduct(product, req.body);
  res.json(result);
};

exports.alerts = async (req, res) => {
  const alerts = await getStockAlerts(req.params.id);
  res.json(alerts);
};

exports.overview = async (req, res) => {
  const { from, to } = req.query;
  const overview = await getProductOverview(req.params.id, from, to);
  res.json(overview);
};

exports.commercial = async (req, res) => {
  const { from, to } = req.query;
  const overview = await getCommercialOverview(req.params.id, from, to);
  res.json(overview);
};

exports.monthlyMatrix = async (req, res) => {
  const months = Math.min(Math.max(parseInt(req.query.months, 10) || 12, 3), 24);
  const topN = Math.min(Math.max(parseInt(req.query.top, 10) || 20, 5), 50);
  const result = await getMonthlyMatrix(req.params.id, { months, topN });
  res.json(result);
};

// Devuelve los top N productos SIN costo cargado, ordenados por revenue del período.
// Sirve para el wizard "Cargá top sellers en 1 click" de Costos: muestra al usuario
// exactamente qué productos cargar primero para ver impacto en márgenes.
exports.costLoadPriority = async (req, res) => {
  const { from, to, limit = 20 } = req.query;
  const storeId = req.params.id;
  const cap = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

  // Productos sin costo cargado.
  const productsWithoutCost = await Product.find({
    storeId,
    $or: [{ costoUnitario: { $exists: false } }, { costoUnitario: 0 }, { costoUnitario: null }],
  }).select('_id tnProductId nombre precio stock').lean();

  if (productsWithoutCost.length === 0) {
    return res.json({ items: [], totalWithoutCost: 0 });
  }

  // Map para join rápido con revenue del período.
  const productIds = productsWithoutCost.map((p) => p.tnProductId).filter(Boolean);
  const match = { storeId: new mongoose.Types.ObjectId(storeId) };
  if (from && to) {
    match.fechaCreacion = buildBusinessSourceDateMatch(from, to);
  }

  let revenueByProduct = new Map();
  try {
    const agg = await Order.aggregate([
      { $match: { ...match, paymentStatus: 'paid' } },
      { $unwind: '$lineItems' },
      { $match: { 'lineItems.tnProductId': { $in: productIds } } },
      {
        $group: {
          _id: '$lineItems.tnProductId',
          revenue: { $sum: { $multiply: ['$lineItems.precioUnitario', '$lineItems.cantidad'] } },
          units: { $sum: '$lineItems.cantidad' },
        },
      },
    ]);
    revenueByProduct = new Map(agg.map((row) => [row._id, row]));
  } catch {
    // Si la aggregation falla, devuelve los productos sin costo igual (orden por precio).
  }

  const enriched = productsWithoutCost.map((p) => {
    const stats = revenueByProduct.get(p.tnProductId) || { revenue: 0, units: 0 };
    return {
      productId: p._id,
      tnProductId: p.tnProductId,
      nombre: p.nombre,
      precio: p.precio || 0,
      stock: p.stock || 0,
      periodRevenue: stats.revenue || 0,
      periodUnits: stats.units || 0,
    };
  });

  // Prioridad: primero los que vendieron más en el período. Empate por precio.
  enriched.sort((a, b) => {
    if (b.periodRevenue !== a.periodRevenue) return b.periodRevenue - a.periodRevenue;
    return (b.precio || 0) - (a.precio || 0);
  });

  res.json({
    items: enriched.slice(0, cap),
    totalWithoutCost: productsWithoutCost.length,
  });
};
