const mongoose = require('mongoose');
const Store = require('../models/Store');
const Order = require('../models/Order');
const Product = require('../models/Product');
const DailyMetric = require('../models/DailyMetric');
const Customer = require('../models/Customer');
const SyncLog = require('../models/SyncLog');
const MetaCampaign = require('../models/MetaCampaign');
const MetaDailyInsight = require('../models/MetaDailyInsight');
const { recalculateDailyMetric } = require('./metricCalculator');
const {
  BUSINESS_TZ,
  buildBusinessDateKeyMatch,
  buildBusinessSourceDateMatch,
  dateKeyToLabel,
} = require('../utils/businessDate');

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function deriveSyncStatus(log, connected, latestSourceAt, staleThresholdHours = 24) {
  if (!connected) return 'disconnected';
  if (log?.status === 'running') return 'running';
  if (log?.status === 'error') return 'error';

  const freshnessRef = latestSourceAt || log?.createdAt || null;
  if (!freshnessRef) return 'connected_no_data';

  const ageMs = Date.now() - new Date(freshnessRef).getTime();
  if (ageMs > staleThresholdHours * 60 * 60 * 1000) return 'stale';
  return 'healthy';
}

/**
 * Get full TiendaNube breakdown for a date range.
 */
async function getTiendaBreakdown(storeId, from, to) {
  const orderDateMatch = buildBusinessSourceDateMatch(from, to);

  const orderMatch = {
    storeId: new mongoose.Types.ObjectId(storeId),
    estado: { $nin: ['cancelled'] },
  };
  if (from || to) orderMatch.fechaCreacion = orderDateMatch;

  const [
    summary,
    byMedioPago,
    byCanal,
    ncrcBreakdown,
    devoluciones,
    dailyOrders,
    aovDaily,
    topCustomers,
    dailyTopProductsAgg,
    dailyTopGatewayAgg,
  ] = await Promise.all([
    // 1. Summary
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: null,
          totalOrdenes: { $sum: 1 },
          totalRevenue: { $sum: '$totalOrden' },
          totalNeto: { $sum: '$totalNeto' },
          totalLiquidable: { $sum: '$liquidable' },
          totalDescuentos: { $sum: '$descuento' },
          totalCostoEnvio: { $sum: '$costoEnvio' },
          totalCostoProductos: { $sum: '$costoProductos' },
          totalComisionPago: { $sum: '$comisionPago' },
          totalComisionCuotas: { $sum: '$comisionCuotas' },
          totalIBB: { $sum: '$impuestosIBB' },
          totalFeePlataforma: { $sum: '$feePlataforma' },
          avgCuotas: { $avg: '$cantidadCuotas' },
        },
      },
    ]).then((r) => r[0] || {}),

    // 2. By medio de pago
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: '$gateway',
          ordenes: { $sum: 1 },
          revenue: { $sum: '$totalOrden' },
          comisionPago: { $sum: '$comisionPago' },
          comisionCuotas: { $sum: '$comisionCuotas' },
          avgCuotas: { $avg: '$cantidadCuotas' },
        },
      },
      { $sort: { revenue: -1 } },
    ]),

    // 3. By canal
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: '$canal',
          ordenes: { $sum: 1 },
          revenue: { $sum: '$totalOrden' },
        },
      },
      { $sort: { revenue: -1 } },
    ]),

    // 4. NC/RC breakdown
    Order.aggregate([
      { $match: { ...orderMatch, esClienteNuevo: { $exists: true } } },
      {
        $group: {
          _id: '$esClienteNuevo',
          ordenes: { $sum: 1 },
          revenue: { $sum: '$totalOrden' },
          netRevenue: { $sum: '$totalNeto' },
          aov: { $avg: '$totalOrden' },
        },
      },
    ]),

    // 5. Devoluciones
    Order.aggregate([
      {
        $match: {
          storeId: new mongoose.Types.ObjectId(storeId),
          ...(from || to ? { fechaCreacion: orderDateMatch } : {}),
          $or: [{ esDevolucion: true }, { estado: 'cancelled' }],
        },
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          total: { $sum: '$totalOrden' },
        },
      },
    ]).then((r) => r[0] || { count: 0, total: 0 }),

    // 6. Daily orders (for chart/table)
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$fechaCreacion', timezone: BUSINESS_TZ } },
          ordenes: { $sum: 1 },
          revenue: { $sum: '$totalOrden' },
          netRevenue: { $sum: '$totalNeto' },
          ncOrdenes: {
            $sum: { $cond: [{ $eq: ['$esClienteNuevo', true] }, 1, 0] },
          },
          rcOrdenes: {
            $sum: { $cond: [{ $eq: ['$esClienteNuevo', false] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // 7. AOV daily
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$fechaCreacion', timezone: BUSINESS_TZ } },
          aov: { $avg: '$totalOrden' },
          ordenes: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // 8. Top customers
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: '$customerEmail',
          name: { $first: '$customerName' },
          ordenes: { $sum: 1 },
          revenue: { $sum: '$totalOrden' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]),

    // 9. Top productos vendidos por día (para expandir filas en "Detalle por día")
    Order.aggregate([
      { $match: orderMatch },
      { $unwind: '$lineItems' },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$fechaCreacion', timezone: BUSINESS_TZ } },
            productKey: { $ifNull: ['$lineItems.tnProductId', '$lineItems.nombre'] },
          },
          nombre: { $first: '$lineItems.nombre' },
          cantidad: { $sum: '$lineItems.cantidad' },
          revenue: { $sum: '$lineItems.subtotal' },
        },
      },
      { $sort: { '_id.day': 1, revenue: -1 } },
      {
        $group: {
          _id: '$_id.day',
          products: {
            $push: {
              nombre: '$nombre',
              cantidad: '$cantidad',
              revenue: '$revenue',
            },
          },
          totalUnits: { $sum: '$cantidad' },
        },
      },
      {
        $project: {
          _id: 1,
          totalUnits: 1,
          products: { $slice: ['$products', 6] },
        },
      },
    ]),

    // 10. Top gateway por día (medio de pago dominante de cada jornada)
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$fechaCreacion', timezone: BUSINESS_TZ } },
            gateway: '$gateway',
          },
          ordenes: { $sum: 1 },
          revenue: { $sum: '$totalOrden' },
        },
      },
      { $sort: { '_id.day': 1, revenue: -1 } },
      {
        $group: {
          _id: '$_id.day',
          top: {
            $first: {
              gateway: '$_id.gateway',
              ordenes: '$ordenes',
              revenue: '$revenue',
            },
          },
          totalRevenue: { $sum: '$revenue' },
        },
      },
    ]),
  ]);

  // Index daily extras por fecha (top products y top gateway)
  const dailyExtras = {};
  for (const row of dailyTopProductsAgg || []) {
    dailyExtras[row._id] = { ...(dailyExtras[row._id] || {}), products: row.products, totalUnits: row.totalUnits };
  }
  for (const row of dailyTopGatewayAgg || []) {
    const sharePct = row.totalRevenue > 0 ? (row.top.revenue / row.totalRevenue) * 100 : 0;
    dailyExtras[row._id] = { ...(dailyExtras[row._id] || {}), topGateway: { ...row.top, sharePct } };
  }

  // Format NC/RC
  const nc = ncrcBreakdown.find((r) => r._id === true) || { ordenes: 0, revenue: 0, netRevenue: 0, aov: 0 };
  const rc = ncrcBreakdown.find((r) => r._id === false) || { ordenes: 0, revenue: 0, netRevenue: 0, aov: 0 };

  return {
    summary: {
      ...summary,
      aov: summary.totalOrdenes > 0 ? summary.totalRevenue / summary.totalOrdenes : 0,
      aovNeto: summary.totalOrdenes > 0 ? summary.totalNeto / summary.totalOrdenes : 0,
    },
    byMedioPago,
    byCanal,
    ncrc: {
      nc: { ordenes: nc.ordenes, revenue: nc.revenue, netRevenue: nc.netRevenue, aov: nc.aov },
      rc: { ordenes: rc.ordenes, revenue: rc.revenue, netRevenue: rc.netRevenue, aov: rc.aov },
      ncPct: (nc.ordenes + rc.ordenes) > 0 ? (nc.ordenes / (nc.ordenes + rc.ordenes)) * 100 : 0,
    },
    devoluciones,
    dailyOrders,
    aovDaily,
    topCustomers,
    dailyExtras,
  };
}

async function getDataAudit(storeId, from, to) {
  const storeObjectId = new mongoose.Types.ObjectId(storeId);
  const orderDateMatch = buildBusinessSourceDateMatch(from, to);
  const metricDateMatch = buildBusinessDateKeyMatch(from, to, true);

  const orderMatch = {
    storeId: storeObjectId,
    estado: { $nin: ['cancelled'] },
  };
  const dailyMatch = { storeId: storeObjectId };
  if (from || to) {
    orderMatch.fechaCreacion = orderDateMatch;
    dailyMatch.date = metricDateMatch;
  }

  const [
    totalOrders,
    totalDailyMetrics,
    ordersMissingCustomer,
    ordersMissingCosts,
    customersWithoutEmail,
    ordersByDay,
    dailyByDay,
  ] = await Promise.all([
    Order.countDocuments(orderMatch),
    DailyMetric.countDocuments(dailyMatch),
    Order.countDocuments({
      ...orderMatch,
      $and: [
        { $or: [{ customerEmail: { $exists: false } }, { customerEmail: null }, { customerEmail: '' }] },
        { $or: [{ externalCustomerId: { $exists: false } }, { externalCustomerId: null }, { externalCustomerId: '' }] },
      ],
    }),
    Order.countDocuments({
      ...orderMatch,
      $or: [
        { costoProductos: { $exists: false } },
        { costoProductos: 0 },
      ],
    }),
    Customer.countDocuments({
      storeId,
      email: /@no-email\.local$/,
    }),
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$fechaCreacion', timezone: BUSINESS_TZ } },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalOrden' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    DailyMetric.aggregate([
      { $match: dailyMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          orders: { $sum: '$ordenes' },
          revenue: { $sum: '$revenue' },
          netRevenue: { $sum: '$netRevenue' },
          adSpend: { $sum: '$adSpend' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const orderMap = new Map(ordersByDay.map((item) => [item._id, item]));
  const dailyMap = new Map(dailyByDay.map((item) => [item._id, item]));
  const allDays = [...new Set([...orderMap.keys(), ...dailyMap.keys()])].sort();

  const mismatches = [];
  let legacyOnlyDays = 0;
  let orderOnlyDays = 0;

  for (const day of allDays) {
    const orderRow = orderMap.get(day);
    const dailyRow = dailyMap.get(day);

    if (!orderRow && dailyRow) {
      legacyOnlyDays++;
      mismatches.push({
        day,
        issue: 'daily_metric_without_orders',
        dailyOrders: dailyRow.orders || 0,
        dailyRevenue: dailyRow.revenue || 0,
      });
      continue;
    }

    if (orderRow && !dailyRow) {
      orderOnlyDays++;
      mismatches.push({
        day,
        issue: 'orders_without_daily_metric',
        orders: orderRow.orders || 0,
        revenue: orderRow.revenue || 0,
      });
      continue;
    }

    const orderDelta = Math.abs((orderRow?.orders || 0) - (dailyRow?.orders || 0));
    const revenueDelta = Math.abs((orderRow?.revenue || 0) - (dailyRow?.revenue || 0));
    if (orderDelta > 0 || revenueDelta > 1) {
      mismatches.push({
        day,
        issue: 'order_daily_mismatch',
        orderOrders: orderRow?.orders || 0,
        dailyOrders: dailyRow?.orders || 0,
        orderRevenue: orderRow?.revenue || 0,
        dailyRevenue: dailyRow?.revenue || 0,
      });
    }
  }

  return {
    summary: {
      totalOrders,
      totalDailyMetrics,
      ordersMissingCustomer,
      ordersMissingCosts,
      customersWithoutEmail,
      legacyOnlyDays,
      orderOnlyDays,
      mismatchedDays: mismatches.length,
      dailyCoveragePct: allDays.length > 0 ? ((allDays.length - orderOnlyDays) / allDays.length) * 100 : 0,
    },
    mismatches: mismatches.slice(0, 30),
  };
}

async function reconcileHistoricalData(storeId, from, to) {
  const storeObjectId = new mongoose.Types.ObjectId(storeId);
  const orderDateMatch = buildBusinessSourceDateMatch(from, to);
  const metricDateMatch = buildBusinessDateKeyMatch(from, to, true);

  const orderMatch = {
    storeId: storeObjectId,
    estado: { $nin: ['cancelled'] },
  };
  const dailyMatch = { storeId: storeObjectId };
  if (from || to) {
    orderMatch.fechaCreacion = orderDateMatch;
    dailyMatch.date = metricDateMatch;
  }

  const [ordersByDay, dailyByDay] = await Promise.all([
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$fechaCreacion', timezone: BUSINESS_TZ } },
          orders: { $sum: 1 },
        },
      },
    ]),
    DailyMetric.aggregate([
      { $match: dailyMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          orders: { $sum: '$ordenes' },
        },
      },
    ]),
  ]);

  const orderDays = ordersByDay.map((item) => item._id);
  const dailyMap = new Map(dailyByDay.map((item) => [item._id, item]));

  let recalculatedDays = 0;
  for (const day of orderDays) {
    await recalculateDailyMetric(storeId, day);
    recalculatedDays++;
  }

  const allDailyDocs = await DailyMetric.find(dailyMatch).select('_id date ordenes dataIntegrity').lean();
  let markedLegacyDays = 0;
  let markedMismatches = 0;

  for (const doc of allDailyDocs) {
    const day = dateKeyToLabel(doc.date);
    const hasOrders = orderDays.includes(day);
    const orderRow = ordersByDay.find((item) => item._id === day);
    const mismatch = hasOrders && Math.abs((orderRow?.orders || 0) - (doc.ordenes || 0)) > 0;

    const notes = [];
    if (!hasOrders) notes.push('legacy_daily_metric_without_orders');
    if (mismatch) notes.push('orders_daily_metric_count_mismatch');

    if (!hasOrders || mismatch) {
      await DailyMetric.findByIdAndUpdate(doc._id, {
        $set: {
          'dataIntegrity.ordersBacked': hasOrders,
          'dataIntegrity.legacyOnly': !hasOrders,
          'dataIntegrity.mismatched': mismatch,
          'dataIntegrity.reconciledAt': new Date(),
          'dataIntegrity.notes': notes,
          'sourceCoverage.orders': hasOrders ? 'available' : 'legacy_or_missing',
        },
      });
      if (!hasOrders) markedLegacyDays++;
      if (mismatch) markedMismatches++;
    }
  }

  const postAudit = await getDataAudit(storeId, from, to);
  return {
    recalculatedDays,
    markedLegacyDays,
    markedMismatches,
    postAudit,
  };
}

async function rebuildStoreHistory(storeId) {
  const storeObjectId = new mongoose.Types.ObjectId(storeId);

  const [orderBounds, dailyBounds] = await Promise.all([
    Order.aggregate([
      { $match: { storeId: storeObjectId, estado: { $nin: ['cancelled'] } } },
      {
        $group: {
          _id: null,
          minDate: { $min: '$fechaCreacion' },
          maxDate: { $max: '$fechaCreacion' },
          orderDays: {
            $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$fechaCreacion', timezone: BUSINESS_TZ } },
          },
        },
      },
    ]).then((rows) => rows[0] || null),
    DailyMetric.aggregate([
      { $match: { storeId: storeObjectId } },
      {
        $group: {
          _id: null,
          minDate: { $min: '$date' },
          maxDate: { $max: '$date' },
        },
      },
    ]).then((rows) => rows[0] || null),
  ]);

  if (!orderBounds && !dailyBounds) {
    return {
      rebuilt: false,
      reason: 'no_data',
      scope: null,
      result: {
        recalculatedDays: 0,
        markedLegacyDays: 0,
        markedMismatches: 0,
        postAudit: await getDataAudit(storeId),
      },
    };
  }

  const minDate = orderBounds?.minDate || dailyBounds?.minDate;
  const maxDate = orderBounds?.maxDate || dailyBounds?.maxDate;
  const from = minDate ? new Date(minDate).toISOString().slice(0, 10) : null;
  const to = maxDate ? new Date(maxDate).toISOString().slice(0, 10) : null;
  const result = await reconcileHistoricalData(storeId, from, to);

  return {
    rebuilt: true,
    reason: null,
    scope: {
      from,
      to,
      orderDays: orderBounds?.orderDays?.length || 0,
    },
    result,
  };
}

async function getSyncStatus(storeId, from, to) {
  const storeObjectId = new mongoose.Types.ObjectId(storeId);
  const store = await Store.findById(storeId)
    .select(
      'nombre plataforma tnStoreId tnNombre tnTokenSource shopifyShopDomain shopifyShopName metaAdAccountId metaAdAccounts integrationStatus'
    )
    .lean();

  if (!store) {
    throw new Error('Store not found');
  }

  const orderDateMatch = buildBusinessSourceDateMatch(from, to);
  const metricDateMatch = buildBusinessDateKeyMatch(from, to, true);

  const tnOrderMatch = {
    storeId: storeObjectId,
    estado: { $nin: ['cancelled'] },
    paymentStatus: 'paid',
    ...(from || to ? { fechaCreacion: orderDateMatch } : {}),
  };
  const dailyMatch = {
    storeId: storeObjectId,
    ...(from || to ? { date: metricDateMatch } : {}),
  };
  const metaInsightMatch = {
    storeId: storeObjectId,
    source: 'api',
    granularity: 'campaign',
    ...(from || to ? { date: metricDateMatch } : {}),
  };

  const [
    latestTnOrder,
    latestTnProduct,
    latestMetaInsight,
    latestDailyMetric,
    tnOrdersCount,
    tnProductsCount,
    metaStructureCounts,
    metaInsightsCount,
    lastOrderLog,
    lastProductLog,
    lastTokenCheckLog,
    lastMetaStructureLog,
    lastMetaInsightsLog,
    tnRawAggregate,
    dailyAggregate,
    metaRawAggregate,
  ] = await Promise.all([
    Order.findOne({ storeId: storeObjectId }).sort({ fechaCreacion: -1 }).select('fechaCreacion updatedAt').lean(),
    Product.findOne({ storeId: storeObjectId }).sort({ updatedAt: -1 }).select('updatedAt').lean(),
    MetaDailyInsight.findOne({ storeId: storeObjectId, source: 'api' }).sort({ date: -1, updatedAt: -1 }).select('date updatedAt').lean(),
    DailyMetric.findOne({ storeId: storeObjectId }).sort({ date: -1 }).select('date revenue netRevenue profit adSpend ordenesPositivas metaPurchases metaPurchaseValue').lean(),
    Order.countDocuments({ storeId: storeObjectId }),
    Product.countDocuments({ storeId: storeObjectId }),
    MetaCampaign.aggregate([
      { $match: { storeId: storeObjectId } },
      { $group: { _id: '$level', count: { $sum: 1 } } },
    ]),
    MetaDailyInsight.countDocuments({ storeId: storeObjectId, source: 'api' }),
    SyncLog.findOne({ storeId: storeObjectId, type: 'tiendanube_orders' }).sort({ updatedAt: -1, createdAt: -1 }).lean(),
    SyncLog.findOne({ storeId: storeObjectId, type: 'tiendanube_products' }).sort({ updatedAt: -1, createdAt: -1 }).lean(),
    SyncLog.findOne({ storeId: storeObjectId, type: 'tiendanube_token_check' }).sort({ updatedAt: -1, createdAt: -1 }).lean(),
    SyncLog.findOne({ storeId: storeObjectId, type: 'meta_structure' }).sort({ updatedAt: -1, createdAt: -1 }).lean(),
    SyncLog.findOne({ storeId: storeObjectId, type: 'meta_insights' }).sort({ updatedAt: -1, createdAt: -1 }).lean(),
    Order.aggregate([
      { $match: tnOrderMatch },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          revenue: { $sum: '$totalOrden' },
          netRevenue: { $sum: '$totalNeto' },
        },
      },
    ]).then((rows) => rows[0] || { orders: 0, revenue: 0, netRevenue: 0 }),
    DailyMetric.aggregate([
      { $match: dailyMatch },
      {
        $group: {
          _id: null,
          orders: { $sum: '$ordenesPositivas' },
          revenue: { $sum: '$revenue' },
          netRevenue: { $sum: '$netRevenue' },
          profit: { $sum: '$profit' },
          adSpend: { $sum: '$adSpend' },
          metaPurchases: { $sum: '$metaPurchases' },
          metaPurchaseValue: { $sum: '$metaPurchaseValue' },
        },
      },
    ]).then(
      (rows) =>
        rows[0] || {
          orders: 0,
          revenue: 0,
          netRevenue: 0,
          profit: 0,
          adSpend: 0,
          metaPurchases: 0,
          metaPurchaseValue: 0,
        }
    ),
    MetaDailyInsight.aggregate([
      { $match: metaInsightMatch },
      {
        $group: {
          _id: null,
          adSpend: { $sum: '$spend' },
          purchases: { $sum: '$purchases' },
          purchaseValue: { $sum: '$purchaseValue' },
        },
      },
    ]).then((rows) => rows[0] || { adSpend: 0, purchases: 0, purchaseValue: 0 }),
  ]);

  const structureMap = metaStructureCounts.reduce(
    (acc, item) => ({ ...acc, [item._id]: item.count }),
    { campaign: 0, adset: 0, ad: 0 }
  );

  const tiendanubeConnected = Boolean(store.integrationStatus?.tiendanube?.connected && store.tnStoreId);
  const metaConnected = Boolean(
    store.integrationStatus?.metaAds?.connected &&
    (store.metaAdAccountId || store.metaAdAccounts?.some((item) => item?.id))
  );
  const metaAccountIds = Array.isArray(store.metaAdAccounts) && store.metaAdAccounts.length
    ? store.metaAdAccounts.map((item) => item.id).filter(Boolean)
    : (store.metaAdAccountId ? [store.metaAdAccountId] : []);

  const tnLastSync =
    store.integrationStatus?.tiendanube?.lastSync ||
    lastTokenCheckLog?.createdAt ||
    lastOrderLog?.createdAt ||
    lastProductLog?.createdAt ||
    null;
  const metaLastSync =
    store.integrationStatus?.metaAds?.lastSync ||
    lastMetaInsightsLog?.createdAt ||
    lastMetaStructureLog?.createdAt ||
    null;

  const tnOrderDelta = {
    orders: (tnRawAggregate.orders || 0) - (dailyAggregate.orders || 0),
    revenue: round2((tnRawAggregate.revenue || 0) - (dailyAggregate.revenue || 0)),
    netRevenue: round2((tnRawAggregate.netRevenue || 0) - (dailyAggregate.netRevenue || 0)),
  };
  const metaDelta = {
    adSpend: round2((metaRawAggregate.adSpend || 0) - (dailyAggregate.adSpend || 0)),
    purchases: (metaRawAggregate.purchases || 0) - (dailyAggregate.metaPurchases || 0),
    purchaseValue: round2((metaRawAggregate.purchaseValue || 0) - (dailyAggregate.metaPurchaseValue || 0)),
  };

  const tnReconciliationOk =
    Math.abs(tnOrderDelta.orders) === 0 &&
    Math.abs(tnOrderDelta.revenue) <= 1 &&
    Math.abs(tnOrderDelta.netRevenue) <= 1;
  const metaReconciliationOk =
    Math.abs(metaDelta.adSpend) <= 1 &&
    Math.abs(metaDelta.purchases) === 0 &&
    Math.abs(metaDelta.purchaseValue) <= 1;

  return {
    store: {
      id: String(store._id),
      nombre: store.nombre,
      plataforma: store.plataforma,
      tnStoreId: store.tnStoreId || null,
      tnTokenSource: store.tnTokenSource || null,
      shopifyShopDomain: store.shopifyShopDomain || null,
      metaAdAccountId: store.metaAdAccountId || null,
      metaAdAccountIds: metaAccountIds,
    },
    connections: {
      tiendanube: {
        connected: tiendanubeConnected,
        tokenSource: store.tnTokenSource || 'manual',
        lastSync: tnLastSync,
        latestSourceRecordAt: latestTnOrder?.fechaCreacion || latestTnProduct?.updatedAt || null,
        status: deriveSyncStatus(
          lastTokenCheckLog || lastOrderLog || lastProductLog,
          tiendanubeConnected,
          latestTnOrder?.fechaCreacion || latestTnProduct?.updatedAt
        ),
        counts: {
          orders: tnOrdersCount,
          products: tnProductsCount,
        },
        lastLogs: {
          token: lastTokenCheckLog,
          orders: lastOrderLog,
          products: lastProductLog,
        },
      },
      metaAds: {
        connected: metaConnected,
        accountId: store.metaAdAccountId || null,
        accountIds: metaAccountIds,
        accountCount: metaAccountIds.length,
        lastSync: metaLastSync,
        latestSourceRecordAt: latestMetaInsight?.updatedAt || latestMetaInsight?.date || null,
        status: deriveSyncStatus(
          lastMetaInsightsLog || lastMetaStructureLog,
          metaConnected,
          latestMetaInsight?.updatedAt || latestMetaInsight?.date
        ),
        counts: {
          campaigns: structureMap.campaign || 0,
          adsets: structureMap.adset || 0,
          ads: structureMap.ad || 0,
          insights: metaInsightsCount,
        },
        lastLogs: {
          structure: lastMetaStructureLog,
          insights: lastMetaInsightsLog,
        },
      },
      dailyMetrics: {
        latestDate: latestDailyMetric?.date || null,
        latestSnapshot: latestDailyMetric || null,
      },
    },
    reconciliation: {
      tiendaNube: {
        raw: {
          orders: tnRawAggregate.orders || 0,
          revenue: round2(tnRawAggregate.revenue || 0),
          netRevenue: round2(tnRawAggregate.netRevenue || 0),
        },
        dailyMetric: {
          orders: dailyAggregate.orders || 0,
          revenue: round2(dailyAggregate.revenue || 0),
          netRevenue: round2(dailyAggregate.netRevenue || 0),
        },
        delta: tnOrderDelta,
        status: tnReconciliationOk ? 'matched' : 'mismatch',
      },
      metaAds: {
        raw: {
          adSpend: round2(metaRawAggregate.adSpend || 0),
          purchases: metaRawAggregate.purchases || 0,
          purchaseValue: round2(metaRawAggregate.purchaseValue || 0),
        },
        dailyMetric: {
          adSpend: round2(dailyAggregate.adSpend || 0),
          purchases: dailyAggregate.metaPurchases || 0,
          purchaseValue: round2(dailyAggregate.metaPurchaseValue || 0),
        },
        delta: metaDelta,
        status: metaReconciliationOk ? 'matched' : 'mismatch',
      },
    },
  };
}

module.exports = {
  getTiendaBreakdown,
  getDataAudit,
  getSyncStatus,
  reconcileHistoricalData,
  rebuildStoreHistory,
};
