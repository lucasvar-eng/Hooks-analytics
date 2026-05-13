const mongoose = require('mongoose');
const Order = require('../models/Order');
const DailyMetric = require('../models/DailyMetric');
const MetaDailyInsight = require('../models/MetaDailyInsight');
const MetaCampaign = require('../models/MetaCampaign');
const { getFixedCostsForRange } = require('./fixedCostService');
const { getBusinessDayContext, buildBusinessDateKeyMatch } = require('../utils/businessDate');
const logger = require('../utils/logger');
const POSITIVE_PAYMENT_STATUSES = ['paid'];

const safeDiv = (a, b) => (b && b > 0 ? a / b : 0);

/**
 * Sprint 1 basic version: aggregates Orders → DailyMetric.
 * Revenue, ordenes, AOV only. Net Revenue and NC/RC added in Sprint 2.
 */
async function recalculateDailyMetric(storeId, date) {
  const { label, keyDate: dayStart, keyEnd: dayEnd, sourceStart, sourceEnd } = getBusinessDayContext(date);
  const storeOid = new mongoose.Types.ObjectId(storeId);

  // 1. Aggregate orders for the day
  const orderAgg = await Order.aggregate([
    {
      $match: {
        storeId: storeOid,
        fechaCreacion: { $gte: sourceStart, $lte: sourceEnd },
        estado: { $nin: ['cancelled'] },
      },
    },
    {
      $group: {
        _id: null,
        ordenes: { $sum: 1 },
        ordenesPositivas: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gt: ['$totalOrden', 0] },
                  { $in: ['$paymentStatus', POSITIVE_PAYMENT_STATUSES] },
                ],
              },
              1,
              0,
            ],
          },
        },
        revenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gt: ['$totalOrden', 0] },
                  { $in: ['$paymentStatus', POSITIVE_PAYMENT_STATUSES] },
                ],
              },
              '$totalOrden',
              0,
            ],
          },
        },
        netRevenue: {
          $sum: {
            $cond: [
              { $in: ['$paymentStatus', POSITIVE_PAYMENT_STATUSES] },
              '$totalNeto',
              0,
            ],
          },
        },
        costoProductos: {
          $sum: {
            $cond: [
              { $in: ['$paymentStatus', POSITIVE_PAYMENT_STATUSES] },
              '$costoProductos',
              0,
            ],
          },
        },
        costoEnvio: {
          $sum: {
            $cond: [
              { $in: ['$paymentStatus', POSITIVE_PAYMENT_STATUSES] },
              '$costoEnvio',
              0,
            ],
          },
        },
        comisionPago: {
          $sum: {
            $cond: [
              { $in: ['$paymentStatus', POSITIVE_PAYMENT_STATUSES] },
              '$comisionPago',
              0,
            ],
          },
        },
        comisionCuotas: {
          $sum: {
            $cond: [
              { $in: ['$paymentStatus', POSITIVE_PAYMENT_STATUSES] },
              '$comisionCuotas',
              0,
            ],
          },
        },
        impuestosIBB: {
          $sum: {
            $cond: [
              { $in: ['$paymentStatus', POSITIVE_PAYMENT_STATUSES] },
              '$impuestosIBB',
              0,
            ],
          },
        },
        feePlataforma: {
          $sum: {
            $cond: [
              { $in: ['$paymentStatus', POSITIVE_PAYMENT_STATUSES] },
              '$feePlataforma',
              0,
            ],
          },
        },
        liquidable: {
          $sum: {
            $cond: [
              { $in: ['$paymentStatus', POSITIVE_PAYMENT_STATUSES] },
              '$liquidable',
              0,
            ],
          },
        },
        ncOrdenes: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$esClienteNuevo', true] },
                  { $in: ['$paymentStatus', POSITIVE_PAYMENT_STATUSES] },
                ],
              },
              1,
              0,
            ],
          },
        },
        ncRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$esClienteNuevo', true] },
                  { $in: ['$paymentStatus', POSITIVE_PAYMENT_STATUSES] },
                ],
              },
              '$totalOrden',
              0,
            ],
          },
        },
        ncNetRevenue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$esClienteNuevo', true] },
                  { $in: ['$paymentStatus', POSITIVE_PAYMENT_STATUSES] },
                ],
              },
              '$totalNeto',
              0,
            ],
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
    fechaCreacion: { $gte: sourceStart, $lte: sourceEnd },
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
          $addFields: {
            sourcePriority: {
              $switch: {
                branches: [
                  { case: { $eq: ['$source', 'api'] }, then: 2 },
                  { case: { $eq: ['$source', 'csv'] }, then: 1 },
                ],
                default: 0,
              },
            },
          },
        },
        { $sort: { sourcePriority: -1, updatedAt: -1 } },
        {
          $group: {
            _id: { metaId: '$metaId', date: '$date' },
            spend: { $first: '$spend' },
            impressions: { $first: '$impressions' },
            reach: { $first: '$reach' },
            frequency: { $first: '$frequency' },
            clicks: { $first: '$clicks' },
            linkClicks: { $first: '$linkClicks' },
            purchases: { $first: '$purchases' },
            purchaseValue: { $first: '$purchaseValue' },
            atc: { $first: '$atc' },
            checkouts: { $first: '$checkouts' },
            source: { $first: '$source' },
          },
        },
        {
          $group: {
            _id: null,
            adSpend: { $sum: '$spend' },
            impressions: { $sum: '$impressions' },
            reach: { $sum: '$reach' },
            frequency: { $avg: '$frequency' },
            clicks: { $sum: '$clicks' },
            linkClicks: { $sum: '$linkClicks' },
            metaPurchases: { $sum: '$purchases' },
            metaPurchaseValue: { $sum: '$purchaseValue' },
            addToCart: { $sum: '$atc' },
            initiatedCheckout: { $sum: '$checkouts' },
            apiRows: {
              $sum: { $cond: [{ $eq: ['$source', 'api'] }, 1, 0] },
            },
            csvRows: {
              $sum: { $cond: [{ $eq: ['$source', 'csv'] }, 1, 0] },
            },
          },
        },
      ])
    : [];

  const m = metaAgg[0] || {
    adSpend: 0,
    impressions: 0,
    reach: 0,
    frequency: 0,
    clicks: 0,
    linkClicks: 0,
    metaPurchases: 0,
    metaPurchaseValue: 0,
    addToCart: 0,
    initiatedCheckout: 0,
    apiRows: 0,
    csvRows: 0,
  };

  // 4. Derived metrics (now with real Meta data)
  const linkClicks = m.linkClicks || m.clicks;
  const landingPageViews = linkClicks;
  const addToCart = m.addToCart || 0;
  const initiatedCheckout = m.initiatedCheckout || 0;
  const sourceCoverage = {
    orders: o.ordenes > 0 ? 'available' : 'none',
    ads: m.apiRows > 0 ? 'api' : m.csvRows > 0 ? 'csv' : 'none',
  };
  const dataIntegrity = {
    ordersBacked: o.ordenes > 0,
    legacyOnly: false,
    mismatched: false,
    reconciledAt: new Date(),
    notes: o.ordenes > 0 ? ['recalculated_from_orders'] : ['no_orders_found_for_day'],
  };
  const derived = {
    aov: safeDiv(o.revenue, o.ordenesPositivas),
    aovNeto: safeDiv(o.netRevenue, o.ordenesPositivas),
    profitMargin: safeDiv(o.netRevenue, o.revenue) * 100,
    ncPct: safeDiv(o.ncOrdenes, o.ordenesPositivas) * 100,
    roas: safeDiv(o.revenue, m.adSpend),
    trueRoas: safeDiv(o.netRevenue, m.adSpend),
    cpa: safeDiv(m.adSpend, m.metaPurchases),
    trueCpa: safeDiv(m.adSpend, o.ordenesPositivas),
    ncCpa: safeDiv(m.adSpend, o.ncOrdenes),
    ncRoas: safeDiv(o.ncRevenue, m.adSpend),
    ncTrueRoas: safeDiv(o.ncNetRevenue, m.adSpend),
    cpc: safeDiv(m.adSpend, linkClicks),
    ctr: safeDiv(m.clicks, m.impressions) * 100,
    cpm: safeDiv(m.adSpend, m.impressions) * 1000,
    frequencyAvg: safeDiv(m.impressions, m.reach),
    cplpv: safeDiv(m.adSpend, landingPageViews),
    cpatc: safeDiv(m.adSpend, addToCart),
    cpcheckout: safeDiv(m.adSpend, initiatedCheckout),
    addToCartRate: safeDiv(addToCart, landingPageViews) * 100,
    checkoutRate: safeDiv(initiatedCheckout, addToCart) * 100,
    purchaseRate: safeDiv(m.metaPurchases, initiatedCheckout || addToCart || landingPageViews) * 100,
    conversionRate: safeDiv(o.ordenesPositivas, landingPageViews) * 100,
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
      frequency: m.frequency,
      clicks: m.clicks,
      linkClicks,
      landingPageViews,
      addToCart,
      initiatedCheckout,
      metaPurchases: m.metaPurchases,
      metaPurchaseValue: m.metaPurchaseValue,
      sourceCoverage,
      dataIntegrity,
      ...derived,
    },
    { upsert: true }
  );

  logger.debug(`DailyMetric updated: store=${storeId} date=${label}`);
}

/**
 * Aggregate DailyMetrics for a date range.
 * Returns { current, previous, deltas }.
 */
async function aggregateRange(storeId, from, to) {
  const storeOid = new mongoose.Types.ObjectId(storeId);
  const dateMatch = buildBusinessDateKeyMatch(from, to, false);

  const agg = await DailyMetric.aggregate([
    {
      $match: {
        storeId: storeOid,
        ...(from || to ? { date: dateMatch } : {}),
      },
    },
    {
      $group: {
        _id: null,
        days: { $sum: 1 },
        ordenes: { $sum: '$ordenes' },
        ordenesPositivas: { $sum: '$ordenesPositivas' },
        revenue: { $sum: '$revenue' },
        netRevenue: { $sum: '$netRevenue' },
        adSpend: { $sum: '$adSpend' },
        impressions: { $sum: '$impressions' },
        reach: { $sum: '$reach' },
        clicks: { $sum: '$clicks' },
        linkClicks: { $sum: '$linkClicks' },
        landingPageViews: { $sum: '$landingPageViews' },
        addToCart: { $sum: '$addToCart' },
        initiatedCheckout: { $sum: '$initiatedCheckout' },
        metaPurchases: { $sum: '$metaPurchases' },
        metaPurchaseValue: { $sum: '$metaPurchaseValue' },
        devoluciones: { $sum: '$devoluciones' },
        ncOrdenes: { $sum: '$ncOrdenes' },
        ncRevenue: { $sum: '$ncRevenue' },
        rcOrdenes: { $sum: '$rcOrdenes' },
        rcRevenue: { $sum: '$rcRevenue' },
        costoProductos: { $sum: '$costoProductos' },
        costoEnvio: { $sum: '$costoEnvio' },
        ordersBackedDays: {
          $sum: { $cond: [{ $eq: ['$dataIntegrity.ordersBacked', true] }, 1, 0] },
        },
        legacyOnlyDays: {
          $sum: { $cond: [{ $eq: ['$dataIntegrity.legacyOnly', true] }, 1, 0] },
        },
        mismatchedDays: {
          $sum: { $cond: [{ $eq: ['$dataIntegrity.mismatched', true] }, 1, 0] },
        },
      },
    },
  ]);

  const d = agg[0] || {};
  const adsCoverage = d.adSpend > 0 || d.impressions > 0 ? 'available' : 'none';
  const ordersCoverage = d.ordenes > 0 ? 'available' : 'none';
  const fixedCosts = await getFixedCostsForRange(storeId, from, to);
  const contributionProfit = d.netRevenue || 0;
  const adjustedProfit = contributionProfit - (d.adSpend || 0) - fixedCosts.total;
  const totalDays = d.days || 0;
  const integrityCoveragePct = totalDays > 0 ? ((d.ordersBackedDays || 0) / totalDays) * 100 : 0;

  return {
    ...d,
    profit: contributionProfit,
    observed: {
      revenue: d.revenue || 0,
      netRevenue: d.netRevenue || 0,
      profit: contributionProfit,
      adSpend: d.adSpend || 0,
      impressions: d.impressions || 0,
      reach: d.reach || 0,
      clicks: d.clicks || 0,
      linkClicks: d.linkClicks || 0,
      landingPageViews: d.landingPageViews || 0,
      addToCart: d.addToCart || 0,
      initiatedCheckout: d.initiatedCheckout || 0,
      purchases: d.ordenesPositivas || 0,
      metaPurchases: d.metaPurchases || 0,
    },
    sourceCoverage: {
      orders: ordersCoverage,
      ads: adsCoverage,
      integrity: {
        totalDays,
        ordersBackedDays: d.ordersBackedDays || 0,
        legacyOnlyDays: d.legacyOnlyDays || 0,
        mismatchedDays: d.mismatchedDays || 0,
        ordersBackedPct: integrityCoveragePct,
      },
    },
    aov: safeDiv(d.revenue, d.ordenesPositivas),
    aovNeto: safeDiv(d.netRevenue, d.ordenesPositivas),
    roas: safeDiv(d.revenue, d.adSpend),
    trueRoas: safeDiv(d.netRevenue, d.adSpend),
    adjustedTrueRoas: safeDiv(adjustedProfit, d.adSpend),
    cpa: safeDiv(d.adSpend, d.ordenesPositivas),
    ctr: safeDiv(d.clicks, d.impressions) * 100,
    cpm: safeDiv(d.adSpend, d.impressions) * 1000,
    cpc: safeDiv(d.adSpend, d.linkClicks || d.clicks),
    frequencyAvg: safeDiv(d.impressions, d.reach),
    addToCartRate: safeDiv(d.addToCart, d.landingPageViews || d.linkClicks || d.clicks) * 100,
    checkoutRate: safeDiv(d.initiatedCheckout, d.addToCart) * 100,
    purchaseRate: safeDiv(d.ordenesPositivas, d.initiatedCheckout || d.addToCart || d.linkClicks || d.clicks) * 100,
    ncPct: safeDiv(d.ncOrdenes, d.ordenesPositivas) * 100,
    profitMargin: safeDiv(d.netRevenue, d.revenue) * 100,
    adjustedProfit,
    adjustedProfitMargin: safeDiv(adjustedProfit, d.revenue) * 100,
    officialProfit: adjustedProfit,
    officialProfitMargin: safeDiv(adjustedProfit, d.revenue) * 100,
    officialTrueRoas: safeDiv(adjustedProfit, d.adSpend),
    fixedCosts: fixedCosts.total,
    conversionRate: safeDiv(d.ordenesPositivas, d.landingPageViews || d.linkClicks || d.clicks) * 100,
    financialTruth: {
      contributionProfit,
      officialProfit: adjustedProfit,
      officialProfitMargin: safeDiv(adjustedProfit, d.revenue) * 100,
      officialTrueRoas: safeDiv(adjustedProfit, d.adSpend),
      fixedCosts: fixedCosts.total,
      mode: 'adjusted_profit_after_fixed_costs',
      profitDataSource: ordersCoverage === 'available' ? 'orders_backed' : 'legacy_daily_metrics',
    },
    derived: {
      aov: safeDiv(d.revenue, d.ordenesPositivas),
      aovNeto: safeDiv(d.netRevenue, d.ordenesPositivas),
      roas: safeDiv(d.revenue, d.adSpend),
      trueRoas: safeDiv(d.netRevenue, d.adSpend),
      adjustedTrueRoas: safeDiv(adjustedProfit, d.adSpend),
      cpa: safeDiv(d.adSpend, d.ordenesPositivas),
      ctr: safeDiv(d.clicks, d.impressions) * 100,
      cpm: safeDiv(d.adSpend, d.impressions) * 1000,
      cpc: safeDiv(d.adSpend, d.linkClicks || d.clicks),
      frequencyAvg: safeDiv(d.impressions, d.reach),
      addToCartRate: safeDiv(d.addToCart, d.landingPageViews || d.linkClicks || d.clicks) * 100,
      checkoutRate: safeDiv(d.initiatedCheckout, d.addToCart) * 100,
      purchaseRate: safeDiv(d.ordenesPositivas, d.initiatedCheckout || d.addToCart || d.linkClicks || d.clicks) * 100,
      ncPct: safeDiv(d.ncOrdenes, d.ordenesPositivas) * 100,
      profitMargin: safeDiv(d.netRevenue, d.revenue) * 100,
      adjustedProfit,
      adjustedProfitMargin: safeDiv(adjustedProfit, d.revenue) * 100,
      officialProfit: adjustedProfit,
      officialProfitMargin: safeDiv(adjustedProfit, d.revenue) * 100,
      officialTrueRoas: safeDiv(adjustedProfit, d.adSpend),
      fixedCosts: fixedCosts.total,
      conversionRate: safeDiv(d.ordenesPositivas, d.landingPageViews || d.linkClicks || d.clicks) * 100,
    },
  };
}

module.exports = { recalculateDailyMetric, aggregateRange };
