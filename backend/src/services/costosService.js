const Product = require('../models/Product');
const Order = require('../models/Order');
const DailyMetric = require('../models/DailyMetric');
const mongoose = require('mongoose');

/**
 * Import product costs from CSV rows.
 * Expects rows with: sku/tnProductId, costoUnitario, (optional) costoEmpaque
 */
async function importProductCosts(storeId, rows) {
  let updated = 0;
  let notFound = [];

  for (const row of rows) {
    const sku = row.sku || row.tnProductId || row.id || row.SKU;
    const costo = parseFloat(row.costoUnitario || row.costo || row.cost || 0);
    const empaque = parseFloat(row.costoEmpaque || row.empaque || row.packaging || 0);

    if (!sku) continue;

    const product = await Product.findOne({ storeId, tnProductId: String(sku) });
    if (!product) {
      // Also try matching by nombre
      const byName = await Product.findOne({
        storeId,
        nombre: { $regex: new RegExp(`^${sku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      });

      if (byName) {
        byName.costoUnitario = costo;
        if (empaque) byName.costoEmpaque = empaque;
        calculateProductMargins(byName);
        await byName.save();
        updated++;
      } else {
        notFound.push(sku);
      }
      continue;
    }

    product.costoUnitario = costo;
    if (empaque) product.costoEmpaque = empaque;
    calculateProductMargins(product);
    await product.save();
    updated++;
  }

  return { updated, notFound };
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
  const match = { storeId: new mongoose.Types.ObjectId(storeId) };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      match.date.$lte = toDate;
    }
  }

  const [agg] = await DailyMetric.aggregate([
    { $match: match },
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
        adSpend: { $sum: '$adSpend' },
        profit: { $sum: '$profit' },
        ordenes: { $sum: '$ordenes' },
      },
    },
  ]);

  if (!agg) {
    return {
      revenue: 0, lines: [], totalCosts: 0, profit: 0, profitMargin: 0, ordenes: 0,
    };
  }

  const lines = [
    { label: 'Costo de Productos (COGS)', value: agg.costoProductos, pct: agg.revenue ? (agg.costoProductos / agg.revenue * 100) : 0 },
    { label: 'Comisión de Pago', value: agg.comisionPago, pct: agg.revenue ? (agg.comisionPago / agg.revenue * 100) : 0 },
    { label: 'Comisión de Cuotas', value: agg.comisionCuotas, pct: agg.revenue ? (agg.comisionCuotas / agg.revenue * 100) : 0 },
    { label: 'Impuestos IBB', value: agg.impuestosIBB, pct: agg.revenue ? (agg.impuestosIBB / agg.revenue * 100) : 0 },
    { label: 'Fee Plataforma', value: agg.feePlataforma, pct: agg.revenue ? (agg.feePlataforma / agg.revenue * 100) : 0 },
    { label: 'Costo de Envío', value: agg.costoEnvio, pct: agg.revenue ? (agg.costoEnvio / agg.revenue * 100) : 0 },
    { label: 'Ad Spend', value: agg.adSpend, pct: agg.revenue ? (agg.adSpend / agg.revenue * 100) : 0 },
  ];

  const totalCosts = lines.reduce((s, l) => s + l.value, 0);
  const profit = agg.revenue - totalCosts;
  const profitMargin = agg.revenue ? (profit / agg.revenue * 100) : 0;

  return {
    revenue: agg.revenue,
    lines,
    totalCosts,
    profit,
    profitMargin,
    ordenes: agg.ordenes,
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
