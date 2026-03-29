const mongoose = require('mongoose');
const Order = require('../models/Order');
const DailyMetric = require('../models/DailyMetric');
const MetaDailyInsight = require('../models/MetaDailyInsight');
const MetaCampaign = require('../models/MetaCampaign');
const logger = require('../utils/logger');

const safeDiv = (a, b) => (b && b > 0 ? a / b : 0);

function startOfDay(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Sprint 1 basic version: aggregates Orders → DailyMetric.
 * Revenue, ordenes, AOV only. Net Revenue and NC/RC added in Sprint 2.
 */
async function recalculateDailyMetric(storeId, date) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const storeOid = new mongoose.Types.ObjectId(storeId);

  // 1. Aggregate orders for the day
  const orderAgg = await Order.aggregate([
    {
      $match: {
        storeId: storeOid,
        fechaCreacion: { $gte: dayStart, $lte: dayEnd },
        estado: { $nin: ['cancelled'] },
      },
    },
    {
      $group: {
        _id: null,
        ordenes: { $sum: 1 },
        ordenesPositivas: {
          $sum: { $cond: [{ $gt: ['$totalOrden', 0] }, 1, 0] },
        },
        revenue: {
          $sum: { $cond: [{ $gt: ['$totalOrden', 0] }, '$totalOrden', 0] },
        },
        netRevenue: { $sum: '$totalNeto' },
        costoProductos: { $sum: '$costoProductos' },
        costoEnvio: { $sum: '$costoEnvio' },
        comisionPago: { $sum: '$comisionPago' },
        comisionCuotas: { $sum: '$comisionCuotas' },
        impuestosIBB: { $sum: '$impuestosIBB' },
        feePlataforma: { $sum: '$feePlataforma' },
        liquidable: { $sum: '$liquidable' },
        ncOrdenes: {
          $sum: { $cond: [{ $eq: ['$esClienteNuevo', true] }, 1, 0] },
        },
        ncRevenue: {
          $sum: {
            $cond: [{ $eq: ['$esClienteNuevo', true] }, '$totalOrden', 0],
          },
        },
        ncNetRevenue: {
          $sum: {
            $cond: [{ $eq: ['$esClienteNuevo', true] }, '$totalNeto', 0],
          },
        },
      },
    },
  ]);

  const o = orderAgg[0] || {
    ordenes: 0,
    ordenesPositivas: 0,
    revenue: 0,
    netRevenue: 0,
    costoProductos: 0,
    costoEnvio: 0,
    comisionPago: 0,
    comisionCuotas: 0,
    impuestosIBB: 0,
    feePlataforma: 0,
    liquidable: 0,
    ncOrdenes: 0,
    ncRevenue: 0,
    ncNetRevenue: 0,
  };

  // 2. Count devoluciones
  const devoluciones = await Order.countDocuments({
    storeId: storeOid,
    fechaCreacion: { $gte: dayStart, $lte: dayEnd },
    estado: { $in: ['cancelled', 'refunded'] },
  });

  // 3. RC from orders
  const rcOrdenes = o.ordenesPositivas - o.ncOrdenes;
  const rcRevenue = o.revenue - o.ncRevenue;

  // 3b. Aggregate Meta insights (campaign-level only to avoid double-counting)
  const campaignIds = await MetaCampaign.find({
    storeId: storeOid,
    level: 'campaign',
  }).distinct('metaId');

  const metaAgg = campaignIds.length > 0
    ? await MetaDailyInsight.aggregate([
        {
          $match: {
            storeId: storeOid,
            metaId: { $in: campaignIds },
            date: { $gte: dayStart, $lte: dayEnd },
          },
        },
        {
          $group: {
            _id: null,
            adSpend: { $sum: '$spend' },
            impressions: { $sum: '$impressions' },
            reach: { $sum: '$reach' },
            clicks: { $sum: '$clicks' },
            metaPurchases: { $sum: '$purchases' },
            metaPurchaseValue: { $sum: '$purchaseValue' },
          },
        },
      ])
    : [];

  const m = metaAgg[0] || {
    adSpend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    metaPurchases: 0,
    metaPurchaseValue: 0,
  };

  // 4. Derived metrics (now with real Meta data)
  const derived = {
    aov: safeDiv(o.revenue, o.ordenesPositivas),
    aovNeto: safeDiv(o.netRevenue, o.ordenesPositivas),
    profitMargin: safeDiv(o.netRevenue, o.revenue) * 100,
    ncPct: safeDiv(o.ncOrdenes, o.ordenesPositivas) * 100,
    roas: safeDiv(o.revenue, m.adSpend),
    trueRoas: safeDiv(o.netRevenue, m.adSpend),
    cpa: safeDiv(m.adSpend, o.ordenesPositivas),
    trueCpa: safeDiv(m.adSpend, o.ordenesPositivas),
    ncCpa: safeDiv(m.adSpend, o.ncOrdenes),
    ncRoas: safeDiv(o.ncRevenue, m.adSpend),
    ncTrueRoas: safeDiv(o.ncNetRevenue, m.adSpend),
    cpc: safeDiv(m.adSpend, m.clicks),
    ctr: safeDiv(m.clicks, m.impressions) * 100,
    cpm: safeDiv(m.adSpend, m.impressions) * 1000,
    conversionRate: safeDiv(o.ordenesPositivas, m.clicks) * 100,
  };

  // 5. Upsert DailyMetric
  await DailyMetric.findOneAndUpdate(
    { storeId: storeOid, date: dayStart },
    {
      ordenes: o.ordenes,
      ordenesPositivas: o.ordenesPositivas,
      revenue: o.revenue,
      netRevenue: o.netRevenue,
      costoProductos: o.costoProductos,
      costoEnvio: o.costoEnvio,
      comisionPago: o.comisionPago,
      comisionCuotas: o.comisionCuotas,
      impuestosIBB: o.impuestosIBB,
      feePlataforma: o.feePlataforma,
      liquidable: o.liquidable,
      ncOrdenes: o.ncOrdenes,
      ncRevenue: o.ncRevenue,
      ncNetRevenue: o.ncNetRevenue,
      rcOrdenes,
      rcRevenue,
      devoluciones,
      profit: o.netRevenue,
      adSpend: m.adSpend,
      impressions: m.impressions,
      reach: m.reach,
      clicks: m.clicks,
      metaPurchases: m.metaPurchases,
      metaPurchaseValue: m.metaPurchaseValue,
      ...derived,
    },
    { upsert: true }
  );

  logger.debug(`DailyMetric updated: store=${storeId} date=${dayStart.toISOString().split('T')[0]}`);
}

/**
 * Aggregate DailyMetrics for a date range.
 * Returns { current, previous, deltas }.
 */
async function aggregateRange(storeId, from, to) {
  const storeOid = new mongoose.Types.ObjectId(storeId);

  const agg = await DailyMetric.aggregate([
    {
      $match: {
        storeId: storeOid,
        date: { $gte: new Date(from), $lte: new Date(to) },
      },
    },
    {
      $group: {
        _id: null,
        ordenes: { $sum: '$ordenes' },
        ordenesPositivas: { $sum: '$ordenesPositivas' },
        revenue: { $sum: '$revenue' },
        netRevenue: { $sum: '$netRevenue' },
        adSpend: { $sum: '$adSpend' },
        profit: { $sum: '$profit' },
        devoluciones: { $sum: '$devoluciones' },
        ncOrdenes: { $sum: '$ncOrdenes' },
        ncRevenue: { $sum: '$ncRevenue' },
        rcOrdenes: { $sum: '$rcOrdenes' },
        rcRevenue: { $sum: '$rcRevenue' },
        costoProductos: { $sum: '$costoProductos' },
        costoEnvio: { $sum: '$costoEnvio' },
      },
    },
  ]);

  const d = agg[0] || {};

  return {
    ...d,
    aov: safeDiv(d.revenue, d.ordenesPositivas),
    aovNeto: safeDiv(d.netRevenue, d.ordenesPositivas),
    roas: safeDiv(d.revenue, d.adSpend),
    trueRoas: safeDiv(d.netRevenue, d.adSpend),
    cpa: safeDiv(d.adSpend, d.ordenesPositivas),
    ncPct: safeDiv(d.ncOrdenes, d.ordenesPositivas) * 100,
    profitMargin: safeDiv(d.netRevenue, d.revenue) * 100,
  };
}

module.exports = { recalculateDailyMetric, aggregateRange };
