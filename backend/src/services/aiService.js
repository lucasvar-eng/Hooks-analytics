const { ai } = require('../config/environment');
const DailyMetric = require('../models/DailyMetric');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const MetaCampaign = require('../models/MetaCampaign');
const MetaDailyInsight = require('../models/MetaDailyInsight');
const CashflowEntry = require('../models/CashflowEntry');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

let Anthropic;
try {
  Anthropic = require('@anthropic-ai/sdk');
} catch {
  // SDK not installed
}

function getClient() {
  if (!Anthropic) throw new Error('@anthropic-ai/sdk not installed. Run: npm install @anthropic-ai/sdk');
  if (!ai.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY no configurada. Agregala en .env o en Settings.');
  return new Anthropic({ apiKey: ai.anthropicApiKey });
}

const SYSTEM_PROMPT = `Sos un analista senior de ecommerce argentino. Tu cliente es una agencia que gestiona tiendas en TiendaNube con Meta Ads.

Reglas:
- Respondé siempre en español argentino
- Sé directo y accionable — no rellenes con generalidades
- Citá números específicos del contexto
- Usá markdown: headers ##, **bold** para KPIs clave, listas para recomendaciones
- Si un dato es 0 o N/A, mencionalo como oportunidad o dato faltante
- Máximo 400 palabras por análisis
- Siempre cerrá con 2-3 acciones concretas priorizadas`;

/**
 * Build context data for a specific section.
 */
async function buildContext(section, storeId, from, to) {
  const sid = new mongoose.Types.ObjectId(storeId);
  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    dateFilter.$lte = toDate;
  }

  const dateMatch = Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {};

  // Base metrics — always included
  const [baseAgg] = await DailyMetric.aggregate([
    { $match: { storeId: sid, ...dateMatch } },
    {
      $group: {
        _id: null,
        days: { $sum: 1 },
        ordenes: { $sum: '$ordenes' },
        ordenesPositivas: { $sum: '$ordenesPositivas' },
        revenue: { $sum: '$revenue' },
        netRevenue: { $sum: '$netRevenue' },
        profit: { $sum: '$profit' },
        adSpend: { $sum: '$adSpend' },
        costoProductos: { $sum: '$costoProductos' },
        comisionPago: { $sum: '$comisionPago' },
        costoEnvio: { $sum: '$costoEnvio' },
        impuestosIBB: { $sum: '$impuestosIBB' },
        feePlataforma: { $sum: '$feePlataforma' },
        ncOrdenes: { $sum: '$ncOrdenes' },
        rcOrdenes: { $sum: '$rcOrdenes' },
        impressions: { $sum: '$impressions' },
        clicks: { $sum: '$clicks' },
        metaPurchases: { $sum: '$metaPurchases' },
        devoluciones: { $sum: '$devoluciones' },
        liquidable: { $sum: '$liquidable' },
        pagosRecibidos: { $sum: '$pagosRecibidos' },
        pagosPendientes: { $sum: '$pagosPendientes' },
      },
    },
  ]);

  if (!baseAgg) return { sin_datos: true, periodo: `${from || 'inicio'} a ${to || 'hoy'}` };

  const b = baseAgg;
  const base = {
    periodo: `${from || 'inicio'} a ${to || 'hoy'}`,
    dias: b.days,
    ordenes: b.ordenes,
    ordenesPositivas: b.ordenesPositivas,
    revenue: Math.round(b.revenue),
    netRevenue: Math.round(b.netRevenue),
    profit: Math.round(b.profit),
    profitMargin: b.revenue > 0 ? ((b.profit / b.revenue) * 100).toFixed(1) + '%' : '0%',
    aov: b.ordenesPositivas > 0 ? Math.round(b.revenue / b.ordenesPositivas) : 0,
    adSpend: Math.round(b.adSpend),
    roas: b.adSpend > 0 ? (b.revenue / b.adSpend).toFixed(2) + 'x' : 'Sin datos',
    trueRoas: b.adSpend > 0 ? (b.netRevenue / b.adSpend).toFixed(2) + 'x' : 'Sin datos',
    cpa: b.metaPurchases > 0 ? Math.round(b.adSpend / b.metaPurchases) : 'Sin datos',
    ncOrdenes: b.ncOrdenes,
    rcOrdenes: b.rcOrdenes,
    ncPct: b.ordenes > 0 ? ((b.ncOrdenes / b.ordenes) * 100).toFixed(1) + '%' : '0%',
    devoluciones: b.devoluciones,
  };

  // Section-specific extra context
  const extra = {};

  if (section === 'costos' || section === 'dashboard') {
    extra.costos = {
      costoProductos: Math.round(b.costoProductos),
      comisionPago: Math.round(b.comisionPago),
      costoEnvio: Math.round(b.costoEnvio),
      impuestosIBB: Math.round(b.impuestosIBB),
      feePlataforma: Math.round(b.feePlataforma),
      totalCostos: Math.round(b.costoProductos + b.comisionPago + b.costoEnvio + b.impuestosIBB + b.feePlataforma),
    };
  }

  if (section === 'cashflow') {
    extra.cashflow = {
      liquidable: Math.round(b.liquidable),
      pagosRecibidos: Math.round(b.pagosRecibidos),
      pagosPendientes: Math.round(b.pagosPendientes),
    };
    // Upcoming payments
    const upcoming = await CashflowEntry.aggregate([
      { $match: { storeId: sid, estado: 'pendiente' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$fechaPago' } },
          total: { $sum: '$liquidable' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 7 },
    ]);
    if (upcoming.length) extra.cashflow.proximosPagos = upcoming;
  }

  if (section === 'productos') {
    const topProducts = await Order.aggregate([
      { $match: { storeId: sid, ...dateMatch, estado: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.nombre',
          vendidos: { $sum: '$items.cantidad' },
          revenue: { $sum: { $multiply: ['$items.precioUnitario', '$items.cantidad'] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);
    extra.topProductos = topProducts.map((p) => ({
      nombre: p._id,
      vendidos: p.vendidos,
      revenue: Math.round(p.revenue),
    }));
  }

  if (section === 'clientes') {
    const segments = await Customer.aggregate([
      { $match: { storeId: sid, rfmSegment: { $exists: true } } },
      {
        $group: {
          _id: '$rfmSegment',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$totalSpent' },
          avgLTV: { $avg: '$ltv' },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);
    extra.segmentosRFM = segments;

    const totalCustomers = await Customer.countDocuments({ storeId: sid });
    extra.totalClientes = totalCustomers;
  }

  if (section === 'meta' || section === 'creativos') {
    const campaigns = await MetaCampaign.find({ storeId: sid, level: 'campaign' }).lean();
    const campaignMetrics = [];
    for (const c of campaigns.slice(0, 10)) {
      const [ins] = await MetaDailyInsight.aggregate([
        { $match: { storeId: sid, metaId: c.metaId, ...dateMatch } },
        {
          $group: {
            _id: null,
            spend: { $sum: '$spend' },
            impressions: { $sum: '$impressions' },
            clicks: { $sum: '$clicks' },
            purchases: { $sum: '$purchases' },
            purchaseValue: { $sum: '$purchaseValue' },
          },
        },
      ]);
      if (ins && ins.spend > 0) {
        campaignMetrics.push({
          nombre: c.nombre,
          spend: Math.round(ins.spend),
          impressions: ins.impressions,
          clicks: ins.clicks,
          purchases: ins.purchases,
          roas: ins.spend > 0 ? (ins.purchaseValue / ins.spend).toFixed(2) + 'x' : '0x',
          cpa: ins.purchases > 0 ? Math.round(ins.spend / ins.purchases) : 'N/A',
        });
      }
    }
    if (campaignMetrics.length) extra.campañas = campaignMetrics;
  }

  return { ...base, ...extra };
}

/**
 * Generate AI analysis for a section.
 */
async function analyze(section, storeId, from, to) {
  const client = getClient();
  const context = await buildContext(section, storeId, from, to);

  const sectionInstructions = {
    dashboard: 'Analiza el rendimiento general: ventas, profit, ROAS vs True ROAS, NC vs RC, tendencias. Identificá lo más urgente.',
    cashflow: 'Analiza el cashflow: liquidez, timing de cobros, comisiones, pagos pendientes. Recomendá cómo mejorar el flujo.',
    meta: 'Analiza el rendimiento de Meta Ads por campaña: ROAS, CPA, CTR. Identificá qué escalar y qué pausar.',
    costos: 'Analiza la estructura de costos: márgenes, líneas más pesadas, oportunidades de optimización. Comparálas con benchmarks.',
    productos: 'Analiza el rendimiento de productos: top sellers, márgenes, oportunidades de bundling o cross-sell.',
    clientes: 'Analiza la base de clientes: segmentos RFM, retención, LTV. Sugerí estrategias por segmento.',
    creativos: 'Analiza el rendimiento de creativos/campañas: clasificación ABCDE, qué escalar, qué matar.',
  };

  const prompt = `${sectionInstructions[section] || sectionInstructions.dashboard}\n\nDatos:\n${JSON.stringify(context, null, 2)}`;

  const response = await client.messages.create({
    model: ai.modelAnalysis,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

  return {
    analysis: text,
    tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
    model: ai.modelAnalysis,
  };
}

/**
 * Chat with AI about store data.
 */
async function chat(messages, storeId, from, to) {
  const client = getClient();
  const context = await buildContext('dashboard', storeId, from, to);

  const systemPrompt = `${SYSTEM_PROMPT}\n\nDatos de la tienda en el período seleccionado:\n${JSON.stringify(context, null, 2)}\n\nSi te preguntan algo que no podés determinar con estos datos, decilo claramente.`;

  const response = await client.messages.create({
    model: ai.modelChat,
    max_tokens: 1000,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const text = response.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

  return {
    response: text,
    tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
  };
}

/**
 * Test API connection.
 */
async function testConnection() {
  const client = getClient();
  await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'OK' }],
  });
  return { status: 'ok' };
}

module.exports = {
  analyze,
  chat,
  testConnection,
};
