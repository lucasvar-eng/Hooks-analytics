const mongoose = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { buildBusinessSourceDateMatch, toBusinessDateLabel } = require('../utils/businessDate');

const POSITIVE_PAYMENT_STATUSES = ['paid'];

function buildPositiveOrderMatch(storeId, from, to) {
  const match = {
    storeId: new mongoose.Types.ObjectId(storeId),
    estado: { $nin: ['cancelled'] },
    paymentStatus: { $in: POSITIVE_PAYMENT_STATUSES },
  };

  if (from || to) match.fechaCreacion = buildBusinessSourceDateMatch(from, to);
  return match;
}

function getLineItemNetSubtotal(order, lineItem) {
  const lineSubtotal = Number(lineItem?.subtotal || 0);
  const orderSubtotal = Number(order?.subtotal || 0);
  const orderDiscount = Number(order?.descuento || 0);

  if (lineSubtotal <= 0) return 0;
  if (orderSubtotal <= 0 || orderDiscount <= 0) return lineSubtotal;

  const proportionalDiscount = (lineSubtotal / orderSubtotal) * orderDiscount;
  return Math.max(0, lineSubtotal - proportionalDiscount);
}

async function getPositiveOrdersWithItems(storeId, from, to, extraMatch = {}) {
  const match = buildPositiveOrderMatch(storeId, from, to);
  Object.assign(match, extraMatch);

  return Order.find(match)
    .select('subtotal descuento lineItems fechaCreacion tnOrderNumber customerName')
    .lean();
}

function buildSalesMapFromOrders(orders) {
  const salesMap = new Map();

  for (const order of orders) {
    for (const lineItem of order.lineItems || []) {
      const productKey = String(lineItem.tnProductId || '');
      if (!productKey) continue;

      const current = salesMap.get(productKey) || {
        unitsSold: 0,
        revenue: 0,
        orders: 0,
        productCost: 0,
      };

      current.unitsSold += Number(lineItem.cantidad || 0);
      current.revenue += getLineItemNetSubtotal(order, lineItem);
      current.orders += 1;
      current.productCost += Number(lineItem.cantidad || 0) * Number(lineItem.costoUnitario || 0);

      salesMap.set(productKey, current);
    }
  }

  return salesMap;
}

async function refreshProductDerivedMetrics(storeId) {
  const storeObjectId = new mongoose.Types.ObjectId(storeId);
  const todayLabel = toBusinessDateLabel(new Date());
  const approxThirtyDaysAgoLabel = toBusinessDateLabel(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const thirtyDaysAgo = buildBusinessSourceDateMatch(approxThirtyDaysAgoLabel, todayLabel).$gte;

  const [sales30d, lastSales] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          storeId: storeObjectId,
          estado: { $nin: ['cancelled'] },
          paymentStatus: { $in: POSITIVE_PAYMENT_STATUSES },
          fechaCreacion: { $gte: thirtyDaysAgo },
        },
      },
      { $unwind: '$lineItems' },
      {
        $group: {
          _id: '$lineItems.tnProductId',
          ventas30dias: { $sum: '$lineItems.cantidad' },
          ultimaVenta: { $max: '$fechaCreacion' },
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          storeId: storeObjectId,
          estado: { $nin: ['cancelled'] },
          paymentStatus: { $in: POSITIVE_PAYMENT_STATUSES },
        },
      },
      { $unwind: '$lineItems' },
      {
        $group: {
          _id: '$lineItems.tnProductId',
          ultimaVenta: { $max: '$fechaCreacion' },
        },
      },
    ]),
  ]);

  const sales30dMap = new Map(sales30d.map((item) => [String(item._id), item]));
  const lastSalesMap = new Map(lastSales.map((item) => [String(item._id), item.ultimaVenta]));
  const products = await Product.find({ storeId }).select('_id tnProductId stock').lean();

  const ops = products.map((product) => {
    const metrics30d = sales30dMap.get(String(product.tnProductId));
    const ventas30dias = metrics30d?.ventas30dias || 0;
    const velocity = ventas30dias / 30;
    const diasDeStock = velocity > 0 ? (product.stock || 0) / velocity : null;
    return {
      updateOne: {
        filter: { _id: product._id },
        update: {
          $set: {
            ventas30dias,
            velocity,
            diasDeStock,
            ultimaVenta: lastSalesMap.get(String(product.tnProductId)) || null,
          },
        },
      },
    };
  });

  if (ops.length > 0) {
    await Product.bulkWrite(ops);
  }
}

/**
 * Get products with sales metrics for a date range.
 */
async function getProductsWithMetrics(storeId, from, to, page = 1, limit = 50) {
  const skip = (page - 1) * limit;

  const [products, total, orders] = await Promise.all([
    Product.find({ storeId }).lean(),
    Product.countDocuments({ storeId }),
    getPositiveOrdersWithItems(storeId, from, to),
  ]);
  const salesMap = buildSalesMapFromOrders(orders);

  // Enrich products
  const enriched = products.map((p) => {
    const sales = salesMap.get(String(p.tnProductId)) || { unitsSold: 0, revenue: 0, orders: 0 };
    return {
      ...p,
      periodSales: sales.unitsSold,
      periodRevenue: sales.revenue,
      periodOrders: sales.orders,
    };
  })
    .sort((a, b) => {
      const salesDelta = (b.periodSales || 0) - (a.periodSales || 0);
      if (salesDelta !== 0) return salesDelta;
      const revenueDelta = (b.periodRevenue || 0) - (a.periodRevenue || 0);
      if (revenueDelta !== 0) return revenueDelta;
      return String(a.nombre || '').localeCompare(String(b.nombre || ''));
    })
    .slice(skip, skip + limit);

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
    paymentStatus: { $in: POSITIVE_PAYMENT_STATUSES },
  })
    .sort({ fechaCreacion: -1 })
    .limit(10)
    .select('tnOrderNumber customerName totalOrden subtotal descuento fechaCreacion lineItems')
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
      subtotal: getLineItemNetSubtotal(o, item),
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

async function getProductOverview(storeId, from, to) {
  const [products, orders] = await Promise.all([
    Product.find({ storeId }).lean(),
    getPositiveOrdersWithItems(storeId, from, to),
  ]);
  const salesMap = buildSalesMapFromOrders(orders);

  const catalog = products.map((product) => {
    const sales = salesMap.get(String(product.tnProductId)) || { unitsSold: 0, revenue: 0, productCost: 0 };
    const stockValue = (product.stock || 0) * ((product.costoUnitario || 0) + (product.costoEmpaque || 0));
    const grossMargin = sales.revenue - sales.productCost;
    const grossMarginPct = sales.revenue > 0 ? (grossMargin / sales.revenue) * 100 : 0;
    const dailyVelocity = sales.unitsSold / Math.max(1, 30);
    const daysOfStock = dailyVelocity > 0 ? (product.stock || 0) / dailyVelocity : null;
    const lastSaleDays = product.ultimaVenta
      ? Math.max(0, Math.floor((Date.now() - new Date(product.ultimaVenta).getTime()) / (1000 * 60 * 60 * 24)))
      : null;
    const agingBucket =
      lastSaleDays == null
        ? 'Sin ventas'
        : lastSaleDays <= 30
          ? '0-30'
          : lastSaleDays <= 60
            ? '31-60'
            : lastSaleDays <= 90
              ? '61-90'
              : '90+';

    return {
      ...product,
      periodSales: sales.unitsSold,
      periodRevenue: sales.revenue,
      stockValue,
      grossMargin,
      grossMarginPct,
      daysOfStock,
      lastSaleDays,
      agingBucket,
      deadStockRisk: (product.stock || 0) > 0 && sales.unitsSold === 0,
      lowReturnRisk: sales.revenue > 0 && grossMarginPct < 20,
      stockoutRisk: ((product.stock || 0) <= 5 && sales.unitsSold > 0) || (daysOfStock != null && daysOfStock < 14),
      overstockRisk: (product.stock || 0) > 0 && (daysOfStock == null || daysOfStock > 90),
      capitalTrapRisk: (product.stock || 0) > 0 && sales.unitsSold === 0 && stockValue > 10000,
      promoPressureRisk: sales.revenue > 0 && grossMarginPct < 15,
    };
  });

  const topSellers = [...catalog]
    .sort((a, b) => (b.periodRevenue || 0) - (a.periodRevenue || 0))
    .slice(0, 5);
  const lowRotation = catalog
    .filter((p) => p.stock > 0 && (p.daysOfStock == null || p.daysOfStock > 60))
    .sort((a, b) => (b.stockValue || 0) - (a.stockValue || 0))
    .slice(0, 8);
  const deadStock = catalog
    .filter((p) => p.deadStockRisk)
    .sort((a, b) => (b.stockValue || 0) - (a.stockValue || 0))
    .slice(0, 8);
  const lowReturn = catalog
    .filter((p) => p.lowReturnRisk)
    .sort((a, b) => (a.grossMarginPct || 0) - (b.grossMarginPct || 0))
    .slice(0, 8);
  const overstock = catalog
    .filter((p) => p.overstockRisk)
    .sort((a, b) => (b.stockValue || 0) - (a.stockValue || 0))
    .slice(0, 8);
  const stockout = catalog
    .filter((p) => p.stockoutRisk)
    .sort((a, b) => (a.daysOfStock || Infinity) - (b.daysOfStock || Infinity))
    .slice(0, 8);

  const summary = catalog.reduce(
    (acc, product) => {
      acc.totalProducts += 1;
      acc.stockUnits += product.stock || 0;
      acc.stockValue += product.stockValue || 0;
      acc.periodRevenue += product.periodRevenue || 0;
      acc.periodSales += product.periodSales || 0;
      acc.deadStockCount += product.deadStockRisk ? 1 : 0;
      acc.lowReturnCount += product.lowReturnRisk ? 1 : 0;
      acc.overstockCount += product.overstockRisk ? 1 : 0;
      acc.stockoutCount += product.stockoutRisk ? 1 : 0;
      acc.productsWithCosts += (product.costoUnitario || 0) > 0 ? 1 : 0;
      return acc;
    },
    {
      totalProducts: 0,
      stockUnits: 0,
      stockValue: 0,
      periodRevenue: 0,
      periodSales: 0,
      deadStockCount: 0,
      lowReturnCount: 0,
      overstockCount: 0,
      stockoutCount: 0,
      productsWithCosts: 0,
    }
  );

  summary.productsWithoutCosts = Math.max(0, summary.totalProducts - summary.productsWithCosts);
  summary.costCoveragePct = summary.totalProducts > 0 ? (summary.productsWithCosts / summary.totalProducts) * 100 : 0;

  return { summary, topSellers, lowRotation, deadStock, lowReturn, overstock, stockout, catalog };
}

async function getCommercialOverview(storeId, from, to) {
  const { summary, topSellers, lowRotation, deadStock, lowReturn, overstock, stockout, catalog } = await getProductOverview(storeId, from, to);

  const [products, orders] = await Promise.all([
    Product.find({ storeId }).lean(),
    getPositiveOrdersWithItems(storeId, from, to),
  ]);

  const productRefMap = new Map(products.map((product) => [String(product.tnProductId), product]));
  const categorySalesMap = new Map();

  for (const order of orders) {
    for (const lineItem of order.lineItems || []) {
      const productRef = productRefMap.get(String(lineItem.tnProductId));
      const categoryName = productRef?.categoria || 'Sin categoría';
      const current = categorySalesMap.get(categoryName) || {
        _id: categoryName,
        unitsSold: 0,
        revenue: 0,
        productCost: 0,
      };
      current.unitsSold += Number(lineItem.cantidad || 0);
      current.revenue += getLineItemNetSubtotal(order, lineItem);
      current.productCost += Number(lineItem.cantidad || 0) * Number(lineItem.costoUnitario || 0);
      categorySalesMap.set(categoryName, current);
    }
  }

  const categorySales = [...categorySalesMap.values()].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));

  const categoryStockMap = products.reduce((acc, product) => {
    const key = product.categoria || 'Sin categoría';
    if (!acc[key]) {
      acc[key] = { stockUnits: 0, stockValue: 0, products: 0 };
    }
    acc[key].stockUnits += product.stock || 0;
    acc[key].stockValue += (product.stock || 0) * ((product.costoUnitario || 0) + (product.costoEmpaque || 0));
    acc[key].products += 1;
    return acc;
  }, {});

  const categories = categorySales.map((category) => {
    const stock = categoryStockMap[category._id] || { stockUnits: 0, stockValue: 0, products: 0 };
    const dailyVelocity = (category.unitsSold || 0) / Math.max(1, 30);
    return {
      categoria: category._id,
      revenue: category.revenue || 0,
      unitsSold: category.unitsSold || 0,
      stockUnits: stock.stockUnits,
      stockValue: stock.stockValue,
      grossMargin: (category.revenue || 0) - (category.productCost || 0),
      grossMarginPct: category.revenue > 0 ? (((category.revenue || 0) - (category.productCost || 0)) / category.revenue) * 100 : 0,
      coverageDays: dailyVelocity > 0 ? stock.stockUnits / dailyVelocity : null,
      products: stock.products,
    };
  });

  const agingSummary = catalog.reduce((acc, product) => {
    const key = product.agingBucket || 'Sin ventas';
    if (!acc[key]) {
      acc[key] = { label: key, products: 0, stockValue: 0 };
    }
    acc[key].products += 1;
    acc[key].stockValue += product.stockValue || 0;
    return acc;
  }, {});

  const categoryConcentration = categories
    .map((category) => ({
      ...category,
      revenueSharePct: summary.periodRevenue > 0 ? (category.revenue / summary.periodRevenue) * 100 : 0,
      stockSharePct: summary.stockValue > 0 ? (category.stockValue / summary.stockValue) * 100 : 0,
    }))
    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
    .slice(0, 6);

  const assortmentMatrix = {
    stars: topSellers.slice(0, 5),
    sleepers: lowRotation.slice(0, 5),
    deadStock: deadStock.slice(0, 5),
    lowReturn: lowReturn.slice(0, 5),
  };

  return {
    summary,
    categories,
    agingSummary: Object.values(agingSummary).sort((a, b) => (b.stockValue || 0) - (a.stockValue || 0)),
    stockHealth: {
      overstock: overstock.slice(0, 5),
      stockout: stockout.slice(0, 5),
      capitalTraps: catalog.filter((item) => item.capitalTrapRisk).sort((a, b) => (b.stockValue || 0) - (a.stockValue || 0)).slice(0, 5),
      promoPressure: catalog.filter((item) => item.promoPressureRisk).sort((a, b) => (a.grossMarginPct || 0) - (b.grossMarginPct || 0)).slice(0, 5),
    },
    categoryConcentration,
    assortmentMatrix,
  };
}

/**
 * Matriz "producto × mes": para los top N productos por revenue del último año,
 * devuelve unidades vendidas mes a mes durante los últimos `months` meses.
 *
 * Estructura: { months: ['2025-06', ..., '2026-05'], products: [{ tnProductId, nombre, stock, monthly: { '2025-06': 12, ... }, total }] }
 */
async function getMonthlyMatrix(storeId, { months = 12, topN = 20 } = {}) {
  const storeObjectId = new mongoose.Types.ObjectId(storeId);
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setMonth(periodStart.getMonth() - months);
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  // Ventana de tiempo total considerada
  const orderMatch = {
    storeId: storeObjectId,
    estado: { $nin: ['cancelled'] },
    fechaCreacion: { $gte: periodStart, $lte: now },
  };

  // Una agregación: agrupa por (producto, mes) → unidades + revenue
  const rows = await Order.aggregate([
    { $match: orderMatch },
    { $unwind: '$lineItems' },
    { $match: { 'lineItems.tnProductId': { $exists: true, $ne: null, $ne: '' } } },
    {
      $group: {
        _id: {
          productId: '$lineItems.tnProductId',
          month: { $dateToString: { format: '%Y-%m', date: '$fechaCreacion', timezone: 'America/Argentina/Buenos_Aires' } },
        },
        unidades: { $sum: '$lineItems.cantidad' },
        revenue: { $sum: '$lineItems.subtotal' },
      },
    },
  ]);

  // Generar lista de meses cubiertos (siempre los últimos N)
  const monthLabels = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    monthLabels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // Agrupar por producto, sumar total
  const byProduct = new Map();
  for (const row of rows) {
    const pid = row._id.productId;
    const month = row._id.month;
    if (!byProduct.has(pid)) {
      byProduct.set(pid, { tnProductId: pid, monthly: {}, totalUnits: 0, totalRevenue: 0 });
    }
    const item = byProduct.get(pid);
    item.monthly[month] = { units: row.unidades, revenue: row.revenue };
    item.totalUnits += row.unidades;
    item.totalRevenue += row.revenue;
  }

  // Hidratar con nombre/stock/precio del producto
  const ids = [...byProduct.keys()];
  const products = await Product.find({ storeId: storeObjectId, tnProductId: { $in: ids } })
    .select('tnProductId nombre stock precio imagenUrl categoria costoUnitario')
    .lean();
  const productMap = new Map(products.map((p) => [p.tnProductId, p]));

  const enriched = [...byProduct.values()].map((item) => {
    const p = productMap.get(item.tnProductId) || {};
    return {
      tnProductId: item.tnProductId,
      nombre: p.nombre || 'Producto desconocido',
      stock: p.stock || 0,
      precio: p.precio || 0,
      imagenUrl: p.imagenUrl || null,
      categoria: p.categoria || '',
      stockValue: (p.stock || 0) * ((p.costoUnitario || 0) || (p.precio || 0) * 0.5),
      monthly: item.monthly,
      totalUnits: item.totalUnits,
      totalRevenue: item.totalRevenue,
    };
  });

  // Top N por revenue total del período
  enriched.sort((a, b) => b.totalRevenue - a.totalRevenue);
  const top = enriched.slice(0, topN);

  return { months: monthLabels, products: top, totalProductsWithSales: enriched.length };
}

module.exports = {
  getProductsWithMetrics,
  getProductProfile,
  simulateProduct,
  getStockAlerts,
  getProductOverview,
  getCommercialOverview,
  refreshProductDerivedMetrics,
  getMonthlyMatrix,
};
