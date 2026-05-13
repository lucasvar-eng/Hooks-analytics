const Product = require('../models/Product');
const Order = require('../models/Order');
const DailyMetric = require('../models/DailyMetric');
const ProductCost = require('../models/ProductCost');
const mongoose = require('mongoose');
const { getFixedCostsForRange } = require('./fixedCostService');
const { buildBusinessDateKeyMatch, buildBusinessSourceDateMatch } = require('../utils/businessDate');

const POSITIVE_PAYMENT_STATUSES = ['paid'];

/**
 * Import product costs from CSV rows.
 * Expects rows with: sku/tnProductId, costoUnitario, (optional) costoEmpaque
 */
async function importProductCosts(storeId, rows, options = {}) {
  let updated = 0;
  const notFound = [];
  const invalidRows = [];
  const seenSkus = new Set();
  const effectiveFrom = options.effectiveFrom ? new Date(options.effectiveFrom) : new Date();
  effectiveFrom.setHours(0, 0, 0, 0);

  for (const [index, row] of rows.entries()) {
    const sku = row.sku || row.tnProductId || row.id || row.SKU;
    const rawCosto = row.costoUnitario ?? row.costo ?? row.cost;
    const rawEmpaque = row.costoEmpaque ?? row.empaque ?? row.packaging;
    const costo = parseFloat(rawCosto || 0);
    const empaque = parseFloat(rawEmpaque || 0);

    if (!sku) {
      invalidRows.push(`Fila ${index + 2}: falta tnProductId/sku`);
      continue;
    }

    const normalizedSku = String(sku).trim();
    if (seenSkus.has(normalizedSku)) {
      invalidRows.push(`Fila ${index + 2}: tnProductId/sku duplicado (${normalizedSku})`);
      continue;
    }
    seenSkus.add(normalizedSku);

    if (rawCosto === undefined || Number.isNaN(costo) || costo < 0) {
      invalidRows.push(`Fila ${index + 2}: costoUnitario inválido para ${normalizedSku}`);
      continue;
    }

    if (rawEmpaque !== undefined && (Number.isNaN(empaque) || empaque < 0)) {
      invalidRows.push(`Fila ${index + 2}: costoEmpaque inválido para ${normalizedSku}`);
      continue;
    }

    const product = await Product.findOne({ storeId, tnProductId: normalizedSku });
    if (!product) {
      notFound.push(normalizedSku);
      continue;
    }

    product.costoUnitario = costo;
    if (rawEmpaque !== undefined) product.costoEmpaque = empaque;
    calculateProductMargins(product);
    await product.save();

    await ProductCost.updateMany(
      {
        storeId,
        tnProductId: normalizedSku,
        isActive: true,
        $or: [
          { effectiveTo: { $exists: false } },
          { effectiveTo: null },
          { effectiveTo: { $gte: effectiveFrom } },
        ],
      },
      {
        $set: {
          isActive: false,
          effectiveTo: new Date(effectiveFrom.getTime() - 1),
        },
      }
    );

    await ProductCost.create({
      storeId,
      tnProductId: normalizedSku,
      sku: normalizedSku,
      costoUnitario: costo,
      costoEmpaque: rawEmpaque !== undefined ? empaque : (product.costoEmpaque || 0),
      source: options.source || 'csv',
      effectiveFrom,
      createdBy: options.createdBy,
    });

    updated++;
  }

  return { updated, notFound, invalidRows };
}

function calculateProductMargins(product) {
  if (product.precio > 0 && product.costoUnitario > 0) {
    product.margenBruto = product.precio - product.costoUnitario - (product.costoEmpaque || 0);
    product.margenBrutoPct = (product.margenBruto / product.precio) * 100;
  }
}

/**
 * Generate P&L for a date range.
 */
async function getPnL(storeId, from, to) {
  const storeObjectId = new mongoose.Types.ObjectId(storeId);
  const orderMatch = {
    storeId: storeObjectId,
    estado: { $nin: ['cancelled'] },
    paymentStatus: { $in: POSITIVE_PAYMENT_STATUSES },
  };
  const dailyMatch = { storeId: storeObjectId };

  if (from || to) {
    orderMatch.fechaCreacion = buildBusinessSourceDateMatch(from, to);
    dailyMatch.date = buildBusinessDateKeyMatch(from, to, true);
  }

  const [[agg], [adsAgg]] = await Promise.all([
    Order.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$totalOrden' },
          netRevenue: { $sum: '$totalNeto' },
          costoProductos: { $sum: '$costoProductos' },
          costoEnvio: { $sum: '$costoEnvio' },
          comisionPago: { $sum: '$comisionPago' },
          comisionCuotas: { $sum: '$comisionCuotas' },
          impuestosIBB: { $sum: '$impuestosIBB' },
          feePlataforma: { $sum: '$feePlataforma' },
          ordenes: { $sum: 1 },
        },
      },
    ]),
    DailyMetric.aggregate([
      { $match: dailyMatch },
      {
        $group: {
          _id: null,
          adSpend: { $sum: '$adSpend' },
        },
      },
    ]),
  ]);

  let baseAgg = agg;
  let dataSource = 'orders';

  if (!baseAgg) {
    const [legacyAgg] = await DailyMetric.aggregate([
      { $match: dailyMatch },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$revenue' },
          netRevenue: { $sum: '$netRevenue' },
          costoProductos: { $sum: '$costoProductos' },
          costoEnvio: { $sum: '$costoEnvio' },
          comisionPago: { $sum: '$comisionPago' },
          comisionCuotas: { $sum: '$comisionCuotas' },
          impuestosIBB: { $sum: '$impuestosIBB' },
          feePlataforma: { $sum: '$feePlataforma' },
          ordenes: { $sum: '$ordenes' },
        },
      },
    ]);
    baseAgg = legacyAgg;
    dataSource = 'daily_metrics_fallback';
  }

  if (!baseAgg) {
    return {
      revenue: 0, lines: [], totalCosts: 0, profit: 0, profitMargin: 0, ordenes: 0,
    };
  }

  const fixedCosts = await getFixedCostsForRange(storeId, from, to);
  const adSpend = adsAgg?.adSpend || 0;

  const lines = [
    { label: 'Costo de Productos (COGS)', value: baseAgg.costoProductos, pct: baseAgg.revenue ? (baseAgg.costoProductos / baseAgg.revenue * 100) : 0 },
    { label: 'Comisión de Pago', value: baseAgg.comisionPago, pct: baseAgg.revenue ? (baseAgg.comisionPago / baseAgg.revenue * 100) : 0 },
    { label: 'Comisión de Cuotas', value: baseAgg.comisionCuotas, pct: baseAgg.revenue ? (baseAgg.comisionCuotas / baseAgg.revenue * 100) : 0 },
    { label: 'Impuestos IBB', value: baseAgg.impuestosIBB, pct: baseAgg.revenue ? (baseAgg.impuestosIBB / baseAgg.revenue * 100) : 0 },
    { label: 'Fee Plataforma', value: baseAgg.feePlataforma, pct: baseAgg.revenue ? (baseAgg.feePlataforma / baseAgg.revenue * 100) : 0 },
    { label: 'Costo de Envío', value: baseAgg.costoEnvio, pct: baseAgg.revenue ? (baseAgg.costoEnvio / baseAgg.revenue * 100) : 0 },
    { label: 'Ad Spend', value: adSpend, pct: baseAgg.revenue ? (adSpend / baseAgg.revenue * 100) : 0 },
    { label: 'Costos Fijos', value: fixedCosts.total, pct: baseAgg.revenue ? (fixedCosts.total / baseAgg.revenue * 100) : 0 },
  ];

  const totalCosts = lines.reduce((s, l) => s + l.value, 0);
  const contributionProfit = baseAgg.netRevenue || 0;
  const profit =
    contributionProfit > 0
      ? contributionProfit - adSpend - fixedCosts.total
      : baseAgg.revenue - totalCosts;
  const profitMargin = baseAgg.revenue ? (profit / baseAgg.revenue * 100) : 0;

  return {
    revenue: baseAgg.revenue,
    lines,
    totalCosts,
    profit,
    profitMargin,
    ordenes: baseAgg.ordenes,
    fixedCosts: fixedCosts.lines,
    contributionProfit,
    dataSource,
  };
}

/**
 * Calculate breakeven metrics.
 */
async function getBreakeven(storeId, from, to) {
  const pnl = await getPnL(storeId, from, to);
  if (!pnl.revenue || !pnl.ordenes) {
    return { roasBreakeven: 0, cpaBreakeven: 0, aovMinimo: 0 };
  }

  const adSpendLine = pnl.lines.find((l) => l.label === 'Ad Spend');
  const adSpend = adSpendLine?.value || 0;

  // Costs without ad spend
  const costsWithoutAds = pnl.totalCosts - adSpend;
  const costPctWithoutAds = pnl.revenue ? costsWithoutAds / pnl.revenue : 0;

  // ROAS breakeven = 1 / (1 - costPct without ads)
  const roasBreakeven = costPctWithoutAds < 1 ? 1 / (1 - costPctWithoutAds) : 0;

  // CPA breakeven = AOV × (1 - costPct without ads)
  const aov = pnl.revenue / pnl.ordenes;
  const cpaBreakeven = aov * (1 - costPctWithoutAds);

  // AOV mínimo = costsPerOrder / (1 - costPct without ads)
  const costsPerOrder = costsWithoutAds / pnl.ordenes;
  const aovMinimo = costPctWithoutAds < 1 ? costsPerOrder / (1 - costPctWithoutAds) : 0;

  return { roasBreakeven, cpaBreakeven, aovMinimo, aov };
}

/**
 * Generate CSV template content.
 */
function getCostTemplate(type) {
  switch (type) {
    case 'productos':
      return 'tnProductId,costoUnitario,costoEmpaque\n12345,1500,100\n67890,800,50\n';
    case 'comisiones':
      return 'medioPago,cuotas,comisionBase,comisionCuotas\nmercadopago,1,4.5,0\nmercadopago,3,4.5,8\nmercadopago,6,4.5,15\nvisa,1,3,0\n';
    case 'envio':
      return 'zona,costoFijo,porcentajeOrden\nCABA,1500,0\nGBA,2000,0\nInterior,3000,0\n';
    case 'adicionales':
      return 'nombre,monto,tipo\nPackaging,200,fijo\nSeguro,2,porcentaje\n';
    default:
      return 'tnProductId,costoUnitario,costoEmpaque\n';
  }
}

module.exports = {
  importProductCosts,
  getPnL,
  getBreakeven,
  getCostTemplate,
};
