const Store = require('../models/Store');
const Product = require('../models/Product');
const ProductCost = require('../models/ProductCost');
const FixedCost = require('../models/FixedCost');
const Order = require('../models/Order');
const DailyMetric = require('../models/DailyMetric');
const { buildBusinessSourceDateMatch } = require('../utils/businessDate');

/**
 * Devuelve un objeto que describe qué componentes de costo están cargados
 * para una tienda y un período, qué falta, y un % de cobertura derivado del
 * revenue del período que pasa por productos con COGS cargado.
 *
 * Se usa en el frontend para mostrar un badge "Preliminar" en las métricas
 * de margen / profit / stock valorizado cuando hay cobertura incompleta.
 */
async function getCostCoverage(storeId, from, to) {
  const empty = makeEmpty();

  const [store, totalProducts, productsWithCosts, productCostsSample, fixedActive, revenueByCost, periodTotals] =
    await Promise.all([
      Store.findById(storeId).lean(),
      Product.countDocuments({ storeId }),
      ProductCost.distinct('productId', { storeId }).then((ids) => ids.length),
      ProductCost.countDocuments({ storeId }),
      countActiveFixedCosts(storeId, from, to),
      computeRevenueByCogsCoverage(storeId, from, to),
      sumCostsForPeriod(storeId, from, to),
    ]);

  // Un componente cuenta como "presente" si:
  //   a) hubo monto > 0 en alguna orden / DailyMetric del período (señal de data real), o
  //   b) está configurado en Store (la app va a aplicarlo a futuro aunque el período aún no tenga data).
  const cogsPresent = productCostsSample > 0;
  const cogsCoveragePct = totalProducts > 0 ? (productsWithCosts / totalProducts) * 100 : 0;
  const paymentCommissionPresent =
    (periodTotals.comisionPago || 0) > 0 ||
    (Array.isArray(store?.comisionPagoConfig) && store.comisionPagoConfig.some((c) => (c?.comisionBase || 0) > 0));
  const installmentCommissionPresent =
    (periodTotals.comisionCuotas || 0) > 0 ||
    (Array.isArray(store?.comisionPagoConfig) && store.comisionPagoConfig.some((c) => (c?.comisionCuotas || 0) > 0));
  const ibbPresent = (periodTotals.impuestosIBB || 0) > 0 || (store?.tasaIBB || 0) > 0;
  const platformFeePresent = (periodTotals.feePlataforma || 0) > 0 || (store?.feePlataformaPct || 0) > 0;
  const shippingCostPresent =
    (periodTotals.costoEnvio || 0) > 0 || (Array.isArray(store?.costosEnvio) && store.costosEnvio.length > 0);
  const fixedCostsPresent = fixedActive > 0;

  const components = {
    cogs: {
      present: cogsPresent,
      label: 'COGS',
      productsWithCosts,
      totalProducts,
      productCoveragePct: round1(cogsCoveragePct),
      revenueCoveragePct: round1(revenueByCost),
    },
    paymentCommission: { present: paymentCommissionPresent, label: 'Comisión MP' },
    installmentCommission: { present: installmentCommissionPresent, label: 'Comisión cuotas' },
    ibb: { present: ibbPresent, label: 'IBB' },
    platformFee: { present: platformFeePresent, label: 'Fee plataforma' },
    shippingCost: { present: shippingCostPresent, label: 'Costo envío' },
    fixedCosts: { present: fixedCostsPresent, label: 'Costos fijos' },
  };

  const missing = Object.entries(components)
    .filter(([, c]) => !c.present)
    .map(([key]) => key);

  // Cobertura global proxy: media simple de presencia (booleanos) ponderada un poco más por COGS,
  // porque es el componente que típicamente afecta más al margen.
  const cogsScore = cogsPresent ? Math.max(0.1, cogsCoveragePct / 100) : 0;
  const others = [
    paymentCommissionPresent,
    installmentCommissionPresent,
    ibbPresent,
    platformFeePresent,
    shippingCostPresent,
    fixedCostsPresent,
  ];
  const othersScore = others.filter(Boolean).length / others.length;
  const coverageScore = cogsScore * 0.4 + othersScore * 0.6;

  return {
    coveragePct: round1(coverageScore * 100),
    components,
    missing,
    isPreliminary: missing.length > 0,
  };

  // helpers
  function makeEmpty() {
    return { coveragePct: 0, components: {}, missing: [], isPreliminary: true };
  }
}

function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}

async function sumCostsForPeriod(storeId, from, to) {
  const empty = { comisionPago: 0, comisionCuotas: 0, impuestosIBB: 0, feePlataforma: 0, costoEnvio: 0 };
  if (!from || !to) return empty;
  try {
    const start = new Date(from);
    const end = new Date(to);
    const agg = await DailyMetric.aggregate([
      { $match: { storeId: toObjectId(storeId), date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: null,
          comisionPago: { $sum: '$comisionPago' },
          comisionCuotas: { $sum: '$comisionCuotas' },
          impuestosIBB: { $sum: '$impuestosIBB' },
          feePlataforma: { $sum: '$feePlataforma' },
          costoEnvio: { $sum: '$costoEnvio' },
        },
      },
    ]);
    return agg[0] || empty;
  } catch {
    return empty;
  }
}

function toObjectId(id) {
  const mongoose = require('mongoose');
  return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
}

async function countActiveFixedCosts(storeId, from, to) {
  const start = from ? new Date(from) : null;
  const end = to ? new Date(to) : null;
  const filter = { storeId, active: { $ne: false } };
  if (start || end) {
    filter.$and = [];
    if (end) filter.$and.push({ $or: [{ periodStart: { $lte: end } }, { periodStart: null }] });
    if (start) filter.$and.push({ $or: [{ periodEnd: { $gte: start } }, { periodEnd: null }] });
    if (!filter.$and.length) delete filter.$and;
  }
  try {
    return await FixedCost.countDocuments(filter);
  } catch {
    return 0;
  }
}

/**
 * % del revenue del período que pasa por productos con costo cargado.
 * Aproximación rápida usando Order.items.productId join con ProductCost.
 */
async function computeRevenueByCogsCoverage(storeId, from, to) {
  if (!from || !to) return 0;
  const match = { storeId };
  match.fechaCreacion = buildBusinessSourceDateMatch(from, to);
  try {
    const agg = await Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'productcosts',
          let: { pid: '$items.productId' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$productId', '$$pid'] }, { $eq: ['$storeId', match.storeId] }] } } },
            { $limit: 1 },
          ],
          as: 'cost',
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $multiply: ['$items.precioUnit', '$items.cantidad'] } },
          covered: {
            $sum: {
              $cond: [
                { $gt: [{ $size: '$cost' }, 0] },
                { $multiply: ['$items.precioUnit', '$items.cantidad'] },
                0,
              ],
            },
          },
        },
      },
    ]);
    const row = agg[0];
    if (!row || !row.total) return 0;
    return (row.covered / row.total) * 100;
  } catch {
    return 0;
  }
}

module.exports = { getCostCoverage };
