const mongoose = require('mongoose');
const CashflowEntry = require('../models/CashflowEntry');
const { getFixedCostsForRange } = require('./fixedCostService');
const logger = require('../utils/logger');

/**
 * Days until payment credit by gateway.
 */
function getGatewayDays(gateway) {
  if (!gateway) return 7;
  const g = gateway.toLowerCase();
  if (g.includes('mercado') || g.includes('mp')) return 14;
  if (g.includes('todopago') || g.includes('todo pago')) return 7;
  if (g.includes('mobbex')) return 3;
  if (g.includes('payway')) return 5;
  if (g.includes('transfer')) return 0;
  if (g.includes('efectivo') || g.includes('cash')) return 0;
  return 7;
}

/**
 * Generate cashflow entries for a paid order.
 * Splits into installments based on cuotas, each with an estimated fechaPago.
 */
async function generateCashflowEntries(order) {
  if (order.paymentStatus !== 'paid' && order.estado !== 'closed') return;

  // Remove previous entries for this order (idempotent)
  await CashflowEntry.deleteMany({ orderId: order._id });

  const cuotas = order.cantidadCuotas || 1;
  const liquidableTotal = order.liquidable || 0;
  const liquidablePorCuota = liquidableTotal / cuotas;
  const comisionTotal = (order.comisionPago || 0) + (order.comisionCuotas || 0);
  const comisionPorCuota = comisionTotal / cuotas;
  const totalPorCuota = (order.totalOrden || 0) / cuotas;

  const diasAcreditacion = getGatewayDays(order.gateway);
  const hoy = new Date();

  const entries = [];
  for (let i = 0; i < cuotas; i++) {
    const fechaPago = new Date(order.paidAt || order.fechaCreacion || order.createdAt);
    fechaPago.setDate(fechaPago.getDate() + diasAcreditacion + i * 30);

    const estado = fechaPago <= hoy ? 'recibido' : 'pendiente';

    entries.push({
      storeId: order.storeId,
      orderId: order._id,
      fechaCreacion: order.fechaCreacion || order.createdAt,
      fechaPago,
      estado,
      totalOrden: totalPorCuota,
      liquidable: liquidablePorCuota,
      comision: comisionPorCuota,
      gateway: order.gateway,
      cuotas,
      numeroCuota: i + 1,
    });
  }

  if (entries.length > 0) {
    await CashflowEntry.insertMany(entries);
  }
}

/**
 * Mark overdue 'pendiente' entries as 'recibido'.
 * Run daily via cron.
 */
async function updateCashflowStates() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const result = await CashflowEntry.updateMany(
    { estado: 'pendiente', fechaPago: { $lte: hoy } },
    { $set: { estado: 'recibido' } }
  );

  if (result.modifiedCount > 0) {
    logger.info(`Cashflow: marked ${result.modifiedCount} entries as recibido`);
  }
}

/**
 * Get cashflow forecast — upcoming payments grouped by week.
 */
async function getCashflowForecast(storeId, weeks = 4) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const hasta = new Date(hoy);
  hasta.setDate(hasta.getDate() + weeks * 7);

  const forecast = await CashflowEntry.aggregate([
    {
      $match: {
        storeId: new mongoose.Types.ObjectId(storeId),
        fechaPago: { $gte: hoy, $lte: hasta },
      },
    },
    {
      $group: {
        _id: {
          semana: { $isoWeek: '$fechaPago' },
          year: { $isoWeekYear: '$fechaPago' },
          estado: '$estado',
        },
        total: { $sum: '$liquidable' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.semana': 1 } },
  ]);

  return forecast;
}

/**
 * Get cashflow summary for a date range (historical view).
 */
async function getCashflowSummary(storeId, from, to) {
  const match = { storeId: new mongoose.Types.ObjectId(storeId) };
  if (from || to) {
    match.fechaPago = {};
    if (from) match.fechaPago.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      match.fechaPago.$lte = toDate;
    }
  }

  const [summary] = await CashflowEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalLiquidable: { $sum: '$liquidable' },
        totalComisiones: { $sum: '$comision' },
        totalBruto: { $sum: '$totalOrden' },
        recibido: {
          $sum: { $cond: [{ $eq: ['$estado', 'recibido'] }, '$liquidable', 0] },
        },
        pendiente: {
          $sum: { $cond: [{ $eq: ['$estado', 'pendiente'] }, '$liquidable', 0] },
        },
        totalEntries: { $sum: 1 },
        entriesRecibidas: {
          $sum: { $cond: [{ $eq: ['$estado', 'recibido'] }, 1, 0] },
        },
        entriesPendientes: {
          $sum: { $cond: [{ $eq: ['$estado', 'pendiente'] }, 1, 0] },
        },
      },
    },
  ]);

  const fixedCosts = await getFixedCostsForRange(storeId, from, to);

  const base = summary || {
    totalLiquidable: 0,
    totalComisiones: 0,
    totalBruto: 0,
    recibido: 0,
    pendiente: 0,
    totalEntries: 0,
    entriesRecibidas: 0,
    entriesPendientes: 0,
  };

  return {
    ...base,
    fixedCosts: fixedCosts.total,
    netAfterFixed: (base.totalLiquidable || 0) - fixedCosts.total,
  };
}

/**
 * Get daily breakdown of cashflow entries.
 */
async function getCashflowDaily(storeId, from, to) {
  const match = { storeId: new mongoose.Types.ObjectId(storeId) };
  if (from || to) {
    match.fechaPago = {};
    if (from) match.fechaPago.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      match.fechaPago.$lte = toDate;
    }
  }

  return CashflowEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$fechaPago' },
        },
        liquidable: { $sum: '$liquidable' },
        comisiones: { $sum: '$comision' },
        bruto: { $sum: '$totalOrden' },
        recibido: {
          $sum: { $cond: [{ $eq: ['$estado', 'recibido'] }, '$liquidable', 0] },
        },
        pendiente: {
          $sum: { $cond: [{ $eq: ['$estado', 'pendiente'] }, '$liquidable', 0] },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

/**
 * Regenerate all cashflow entries for a store.
 */
async function regenerateAllCashflow(storeId) {
  const Order = require('../models/Order');

  await CashflowEntry.deleteMany({ storeId });

  const orders = await Order.find({
    storeId,
    paymentStatus: 'paid',
    estado: { $nin: ['cancelled'] },
  });

  let count = 0;
  for (const order of orders) {
    await generateCashflowEntries(order);
    count++;
  }

  logger.info(`Cashflow: regenerated entries for ${count} orders`);
  return count;
}

module.exports = {
  generateCashflowEntries,
  updateCashflowStates,
  getCashflowForecast,
  getCashflowSummary,
  getCashflowDaily,
  regenerateAllCashflow,
  getGatewayDays,
};
