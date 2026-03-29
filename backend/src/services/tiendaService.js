const mongoose = require('mongoose');
const Order = require('../models/Order');
const DailyMetric = require('../models/DailyMetric');

/**
 * Get full TiendaNube breakdown for a date range.
 */
async function getTiendaBreakdown(storeId, from, to) {
  const dateMatch = {};
  if (from) dateMatch.$gte = new Date(from);
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    dateMatch.$lte = toDate;
  }

  const orderMatch = {
    storeId: new mongoose.Types.ObjectId(storeId),
    estado: { $nin: ['cancelled'] },
  };
  if (from || to) orderMatch.fechaCreacion = dateMatch;

  const [
    summary,
    byMedioPago,
    byCanal,
    ncrcBreakdown,
    devoluciones,
    dailyOrders,
    aovDaily,
    topCustomers,
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
          ...(from || to ? { fechaCreacion: dateMatch } : {}),
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
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$fechaCreacion' } },
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
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$fechaCreacion' } },
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
  ]);

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
  };
}

module.exports = { getTiendaBreakdown };
