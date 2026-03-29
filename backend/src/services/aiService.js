const { ai } = require('../config/environment');
const DailyMetric = require('../models/DailyMetric');
const mongoose = require('mongoose');
const logger = require('../utils/logger');

let Anthropic;
try {
  Anthropic = require('@anthropic-ai/sdk');
} catch {
  // SDK not installed yet — will fail gracefully
}

function getClient() {
  if (!Anthropic) throw new Error('@anthropic-ai/sdk not installed. Run: npm install @anthropic-ai/sdk');
  if (!ai.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  return new Anthropic({ apiKey: ai.anthropicApiKey });
}

/**
 * Generate AI analysis for a section.
 */
async function analyze(section, storeId, from, to) {
  const client = getClient();

  // Get metrics data
  const metrics = await getMetricsForContext(storeId, from, to);

  const sectionPrompts = {
    dashboard: `Analiza el rendimiento general de esta tienda de ecommerce. Datos del período:\n${JSON.stringify(metrics, null, 2)}\n\nDa insights accionables sobre: ventas, profit, ROAS, CPA, NC vs RC. Identifica tendencias y oportunidades.`,
    cashflow: `Analiza el cashflow de esta tienda. Datos:\n${JSON.stringify(metrics, null, 2)}\n\nFocalizá en: liquidez, comisiones, timing de cobros, recomendaciones para mejorar el flujo de caja.`,
    meta: `Analiza el rendimiento de Meta Ads. Datos:\n${JSON.stringify(metrics, null, 2)}\n\nFocalizá en: ROAS, CPA, CTR, eficiencia del gasto publicitario. Sugiere optimizaciones.`,
    costos: `Analiza la estructura de costos. Datos:\n${JSON.stringify(metrics, null, 2)}\n\nIdentificá líneas de costo que se pueden optimizar, márgenes por mejorar, y recomendaciones de pricing.`,
    productos: `Analiza el rendimiento de productos. Datos:\n${JSON.stringify(metrics, null, 2)}\n\nIdentificá top performers, productos con bajo margen, dead stock, oportunidades de cross-sell.`,
    clientes: `Analiza la base de clientes. Datos:\n${JSON.stringify(metrics, null, 2)}\n\nFocalizá en: retención, LTV, segmentos de mayor valor, estrategias para reducir churn y aumentar frecuencia.`,
  };

  const prompt = sectionPrompts[section] || sectionPrompts.dashboard;

  const response = await client.messages.create({
    model: ai.modelAnalysis,
    max_tokens: 1500,
    system: 'Sos un analista experto en ecommerce argentino. Respondé en español. Sé directo, da insights accionables con números. Usá markdown para formatear.',
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

  return {
    analysis: text,
    tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
    model: ai.modelAnalysis,
  };
}

/**
 * Chat with AI about store data.
 */
async function chat(messages, storeId, from, to) {
  const client = getClient();

  const metrics = await getMetricsForContext(storeId, from, to);

  const systemPrompt = `Sos un asistente de analytics para una tienda de ecommerce argentina. Tenés acceso a estos datos del período seleccionado:\n\n${JSON.stringify(metrics, null, 2)}\n\nRespondé en español, sé conciso y da datos concretos cuando sea posible. Si te preguntan algo que no podés determinar con los datos disponibles, decilo.`;

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
    tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
  };
}

/**
 * Get aggregated metrics for AI context.
 */
async function getMetricsForContext(storeId, from, to) {
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
        days: { $sum: 1 },
        ordenes: { $sum: '$ordenes' },
        revenue: { $sum: '$revenue' },
        netRevenue: { $sum: '$netRevenue' },
        profit: { $sum: '$profit' },
        adSpend: { $sum: '$adSpend' },
        ncOrdenes: { $sum: '$ncOrdenes' },
        rcOrdenes: { $sum: '$rcOrdenes' },
        costoProductos: { $sum: '$costoProductos' },
        comisionPago: { $sum: '$comisionPago' },
        costoEnvio: { $sum: '$costoEnvio' },
        impressions: { $sum: '$impressions' },
        clicks: { $sum: '$clicks' },
        metaPurchases: { $sum: '$metaPurchases' },
      },
    },
  ]);

  if (!agg) return { message: 'Sin datos para el período seleccionado' };

  return {
    periodo: `${from || 'inicio'} a ${to || 'hoy'}`,
    dias: agg.days,
    ordenes: agg.ordenes,
    revenue: agg.revenue,
    netRevenue: agg.netRevenue,
    profit: agg.profit,
    profitMargin: agg.revenue > 0 ? ((agg.profit / agg.revenue) * 100).toFixed(1) + '%' : '0%',
    aov: agg.ordenes > 0 ? (agg.revenue / agg.ordenes).toFixed(0) : 0,
    adSpend: agg.adSpend,
    roas: agg.adSpend > 0 ? (agg.revenue / agg.adSpend).toFixed(2) : 'N/A',
    cpa: agg.metaPurchases > 0 ? (agg.adSpend / agg.metaPurchases).toFixed(0) : 'N/A',
    ctr: agg.impressions > 0 ? ((agg.clicks / agg.impressions) * 100).toFixed(2) + '%' : 'N/A',
    ncOrdenes: agg.ncOrdenes,
    rcOrdenes: agg.rcOrdenes,
    ncPct: agg.ordenes > 0 ? ((agg.ncOrdenes / agg.ordenes) * 100).toFixed(1) + '%' : '0%',
  };
}

/**
 * Test API connection.
 */
async function testConnection() {
  const client = getClient();
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 50,
    messages: [{ role: 'user', content: 'Respond with "OK"' }],
  });
  return { status: 'ok', model: 'claude-haiku-4-5-20251001' };
}

module.exports = {
  analyze,
  chat,
  testConnection,
};
