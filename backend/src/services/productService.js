const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');

/**
 * Get products with sales metrics for a date range.
 */
async function getProductsWithMetrics(storeId, from, to, page = 1, limit = 50) {
  const skip = (page - 1) * limit;

  // Get products
  const [products, total] = await Promise.all([
    Product.find({ storeId })
      .sort({ ventas30dias: -1, nombre: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments({ storeId }),
  ]);

  // Get sales per product in date range
  const dateMatch = {};
  if (from) dateMatch.$gte = new Date(from);
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    dateMatch.$lte = toDate;
  }

  const orderMatch = { storeId: new mongoose.Types.ObjectId(storeId), estado: { $nin: ['cancelled'] } };
  if (from || to) orderMatch.fechaCreacion = dateMatch;

  const salesAgg = await Order.aggregate([
    { $match: orderMatch },
    { $unwind: '$lineItems' },
    {
      $group: {
        _id: '$lineItems.tnProductId',
        unitsSold: { $sum: '$lineItems.cantidad' },
        revenue: { $sum: '$lineItems.subtotal' },
        orders: { $sum: 1 },
      },
    },
  ]);

  const salesMap = {};
  for (const s of salesAgg) {
    salesMap[s._id] = s;
  }

  // Enrich products
  const enriched = products.map((p) => {
    const sales = salesMap[p.tnProductId] || { unitsSold: 0, revenue: 0, orders: 0 };
    return {
      ...p,
      periodSales: sales.unitsSold,
      periodRevenue: sales.revenue,
      periodOrders: sales.orders,
    };
  });

  return { products: enriched, total, page, limit };
}

/**
 * Get detailed product profile with cost breakdown.
 */
async function getProductProfile(storeId, productId) {
  const product = await Product.findOne({ storeId, _id: productId }).lean();
  if (!product) return null;

  // Get recent orders containing this product
  const recentOrders = await Order.find({
    storeId,
    'lineItems.tnProductId': product.tnProductId,
    estado: { $nin: ['cancelled'] },
  })
    .sort({ fechaCreacion: -1 })
    .limit(10)
    .select('tnOrderNumber customerName totalOrden fechaCreacion lineItems')
    .lean();

  // Extract only the relevant line item from each order
  const orders = recentOrders.map((o) => {
    const item = o.lineItems.find((li) => li.tnProductId === product.tnProductId);
    return {
      tnOrderNumber: o.tnOrderNumber,
      customerName: o.customerName,
      fecha: o.fechaCreacion,
      cantidad: item?.cantidad || 0,
      precioUnitario: item?.precioUnitario || 0,
      subtotal: item?.subtotal || 0,
    };
  });

  return { ...product, recentOrders: orders };
}

/**
 * Simulate margin changes for a product.
 */
function simulateProduct(product, changes) {
  const precio = changes.precio ?? product.precio;
  const cogs = changes.costoUnitario ?? product.costoUnitario;
  const empaque = changes.costoEmpaque ?? product.costoEmpaque ?? 0;

  const margenBruto = precio - cogs - empaque;
  const margenBrutoPct = precio > 0 ? (margenBruto / precio) * 100 : 0;

  return { precio, cogs, empaque, margenBruto, margenBrutoPct };
}

/**
 * Get stock alerts.
 */
async function getStockAlerts(storeId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 90);

  const [lowStock, outOfStock, deadStock] = await Promise.all([
    Product.find({ storeId, stock: { $gt: 0, $lte: 5 } }).lean(),
    Product.find({ storeId, stock: 0 }).lean(),
    Product.find({
      storeId,
      stock: { $gt: 0 },
      $or: [
        { ultimaVenta: { $lte: thirtyDaysAgo } },
        { ultimaVenta: null, ventas30dias: 0 },
      ],
    }).lean(),
  ]);

  return { lowStock, outOfStock, deadStock };
}

module.exports = {
  getProductsWithMetrics,
  getProductProfile,
  simulateProduct,
  getStockAlerts,
};
