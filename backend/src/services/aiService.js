/**
 * aiService — versión post-MCP (mayo 2026).
 *
 * Quedó SOLO el armado del contexto de datos para que una IA externa (Claude vía
 * MCP, Codex, etc.) lo consuma como input. Las funciones de chat/analyze/
 * structuredInsights/fallback fueron eliminadas: la IA ya no corre dentro de la
 * app — entra por MCP, lee el contexto, y sube resultados con create_report /
 * save_analysis / create_team_note.
 *
 * Mantiene:
 *  - BASE_SYSTEM_PROMPT y SECTION_PLAYBOOKS: documentación de qué se espera de
 *    cada sección. Lo exponemos por MCP como hint para la IA externa.
 *  - buildContext(section, storeId, from, to): cargas pesadas de Mongo
 *    convertidas a un objeto de métricas listo para inyectar en un prompt.
 */
const mongoose = require('mongoose');
const Store = require('../models/Store');
const DailyMetric = require('../models/DailyMetric');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const MetaCampaign = require('../models/MetaCampaign');
const MetaDailyInsight = require('../models/MetaDailyInsight');
const CashflowEntry = require('../models/CashflowEntry');
const TopicMap = require('../models/TopicMap');
const LanguageBank = require('../models/LanguageBank');
const Competitor = require('../models/Competitor');
const { getEffectiveTarget } = require('./targetService');
const { getDataAudit } = require('./tiendaService');
const { getFixedCostsForRange } = require('./fixedCostService');
const {
  getTopicMapOverview,
  getLanguageBankOverview,
  getCompetitorOverview,
} = require('./contentStrategyService');
const { buildBusinessDateKeyMatch } = require('../utils/businessDate');

const BASE_SYSTEM_PROMPT = `Sos un analista senior de ecommerce argentino. Tu cliente es una agencia que gestiona tiendas en TiendaNube con Meta Ads.

Reglas:
- Respondé siempre en español argentino
- Sé directo y accionable — no rellenes con generalidades
- Citá números específicos del contexto
- Usá markdown: headers ##, **bold** para KPIs clave, listas para recomendaciones
- Si un dato es 0 o N/A, mencionalo como oportunidad o dato faltante
- Máximo 400 palabras por análisis
- Siempre cerrá con 2-3 acciones concretas priorizadas`;

const SECTION_PLAYBOOKS = {
  dashboard: {
    objective: 'leer el negocio completo con foco en ventas, profit, marketing, clientes y riesgo operativo',
    mustInclude: ['métrica principal del período', 'cuello de botella principal', 'lectura de NC vs RC', '3 acciones priorizadas'],
  },
  cashflow: {
    objective: 'priorizar liquidez y timing de cobros sobre métricas cosméticas',
    mustInclude: ['liquidable', 'pagos recibidos', 'pagos pendientes', 'riesgo de caja'],
  },
  meta: {
    objective: 'detectar eficiencia publicitaria real, no solo volumen',
    mustInclude: ['spend', 'compras', 'ROAS o true ROAS', 'riesgo de escalar sin base'],
  },
  costos: {
    objective: 'separar costos variables, costos fijos y su impacto en profit real',
    mustInclude: ['contribution profit', 'adjusted profit', 'costos fijos', 'breakeven'],
  },
  productos: {
    objective: 'leer catálogo y surtido con foco comercial',
    mustInclude: ['top sellers', 'riesgo comercial', 'faltantes de costo o stock', 'oportunidad puntual'],
  },
  clientes: {
    objective: 'entender adquisición, recompra y calidad de base',
    mustInclude: ['NC vs RC', 'retención', 'lag de recompra', 'calidad del dato de clientes'],
  },
  creativos: {
    objective: 'bajar decisiones de creatividad y no solo opinar sobre anuncios',
    mustInclude: ['qué escalar', 'qué pausar', 'qué testear', 'gaps del framework'],
  },
  'topic-map': {
    objective: 'ordenar el framework creativo con foco en consciencia, gaps y priorización',
    mustInclude: ['tema prioritario', 'gap del framework', 'territorio o ángulo faltante', 'acción concreta'],
  },
  'language-bank': {
    objective: 'detectar si el lenguaje comercial cubre hooks, objeciones y territorios clave',
    mustInclude: ['hook o patrón fuerte', 'objeción sin respuesta', 'hueco de lenguaje', 'acción concreta'],
  },
  diagnostics: {
    objective: 'identificar anomalías y riesgos de integridad o negocio',
    mustInclude: ['principal anomalía', 'impacto', 'dato faltante o inconsistente', 'acción correctiva'],
  },
  competencia: {
    objective: 'comparar posicionamiento y oportunidades sin inventar certezas',
    mustInclude: ['ventaja detectada', 'gap de mensaje', 'oportunidad concreta', 'nivel de confianza'],
  },
  report: {
    objective: 'resumir ejecutivamente el período para decisión rápida',
    mustInclude: ['1 lectura central', '2 o 3 acciones', 'nivel de confianza del dato'],
  },
};

function getSectionPlaybook(section) {
  return SECTION_PLAYBOOKS[section] || SECTION_PLAYBOOKS.dashboard;
}

/**
 * Build data context for a specific section.
 * Output: objeto con métricas, costos, audit, framework creativo, etc. — lo que
 * necesite la IA externa para escribir un análisis sin recalcular nada.
 */
async function buildContext(section, storeId, from, to) {
  const sid = new mongoose.Types.ObjectId(storeId);
  const dateFilter = from || to ? buildBusinessDateKeyMatch(from, to, true) : {};

  const dateMatch = Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {};

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
        profit: { $sum: '$netRevenue' },
        adSpend: { $sum: '$adSpend' },
        adjustedProfit: { $sum: '$adjustedProfit' },
        fixedCosts: { $sum: '$fixedCosts' },
        costoProductos: { $sum: '$costoProductos' },
        comisionPago: { $sum: '$comisionPago' },
        costoEnvio: { $sum: '$costoEnvio' },
        impuestosIBB: { $sum: '$impuestosIBB' },
        feePlataforma: { $sum: '$feePlataforma' },
        ncOrdenes: { $sum: '$ncOrdenes' },
        rcOrdenes: { $sum: '$rcOrdenes' },
        impressions: { $sum: '$impressions' },
        clicks: { $sum: '$clicks' },
        linkClicks: { $sum: '$linkClicks' },
        landingPageViews: { $sum: '$landingPageViews' },
        addToCart: { $sum: '$addToCart' },
        initiatedCheckout: { $sum: '$initiatedCheckout' },
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
  const [target, audit, fixedCosts] = await Promise.all([
    getEffectiveTarget(storeId, { from, to }),
    getDataAudit(storeId, from, to),
    getFixedCostsForRange(storeId, from, to),
  ]);

  const trustScore = (() => {
    let score = 1;
    if (audit?.summary?.legacyOnlyDays) score -= Math.min(0.5, audit.summary.legacyOnlyDays * 0.08);
    if (audit?.summary?.mismatchedDays) score -= Math.min(0.3, audit.summary.mismatchedDays * 0.05);
    if (audit?.summary?.ordersMissingCustomer) score -= 0.1;
    if (audit?.summary?.ordersMissingCosts) score -= 0.15;
    return Math.max(0.1, Math.min(1, score));
  })();

  const base = {
    periodo: `${from || 'inicio'} a ${to || 'hoy'}`,
    dias: b.days,
    ordenes: b.ordenes,
    ordenesPositivas: b.ordenesPositivas,
    revenue: Math.round(b.revenue),
    netRevenue: Math.round(b.netRevenue),
    profit: Math.round(b.profit),
    adjustedProfit: Math.round(b.adjustedProfit || (b.netRevenue - (b.adSpend || 0) - fixedCosts.total)),
    profitMargin: b.revenue > 0 ? ((b.profit / b.revenue) * 100).toFixed(1) + '%' : '0%',
    adjustedProfitMargin: b.revenue > 0 ? ((((b.adjustedProfit || (b.netRevenue - (b.adSpend || 0) - fixedCosts.total))) / b.revenue) * 100).toFixed(1) + '%' : '0%',
    aov: b.ordenesPositivas > 0 ? Math.round(b.revenue / b.ordenesPositivas) : 0,
    adSpend: Math.round(b.adSpend),
    roas: b.adSpend > 0 ? (b.revenue / b.adSpend).toFixed(2) + 'x' : 'Sin datos',
    trueRoas: b.adSpend > 0 ? (b.netRevenue / b.adSpend).toFixed(2) + 'x' : 'Sin datos',
    adjustedTrueRoas: b.adSpend > 0 ? ((b.adjustedProfit || (b.netRevenue - (b.adSpend || 0) - fixedCosts.total)) / b.adSpend).toFixed(2) + 'x' : 'Sin datos',
    cpa: b.metaPurchases > 0 ? Math.round(b.adSpend / b.metaPurchases) : 'Sin datos',
    ncOrdenes: b.ncOrdenes,
    rcOrdenes: b.rcOrdenes,
    ncPct: b.ordenes > 0 ? ((b.ncOrdenes / b.ordenes) * 100).toFixed(1) + '%' : '0%',
    devoluciones: b.devoluciones,
    sourceCoverage: {
      ads: b.adSpend > 0 ? 'available' : 'none',
      orders: b.ordenes > 0 ? 'available' : 'legacy_or_missing',
    },
    dataQuality: {
      confidence: Number(trustScore.toFixed(2)),
      auditSummary: audit?.summary || {},
      note:
        trustScore >= 0.8
          ? 'Alta confianza'
          : trustScore >= 0.5
            ? 'Confianza media: revisar integridad antes de decisiones sensibles'
            : 'Baja confianza: hay dependencia fuerte de datos legacy o inconsistencias',
    },
  };

  const extra = {};

  if (target) {
    extra.targets = {
      phase: target.phase,
      kpis: target.kpis || {},
      breakeven: target.breakeven || {},
      source: target.source || (target.isFallback ? 'fallback_store_objetivos' : 'manual'),
    };
  }

  if (section === 'costos' || section === 'dashboard') {
    extra.costos = {
      costoProductos: Math.round(b.costoProductos),
      comisionPago: Math.round(b.comisionPago),
      costoEnvio: Math.round(b.costoEnvio),
      impuestosIBB: Math.round(b.impuestosIBB),
      feePlataforma: Math.round(b.feePlataforma),
      fixedCosts: Math.round(fixedCosts.total),
      totalCostos: Math.round(b.costoProductos + b.comisionPago + b.costoEnvio + b.impuestosIBB + b.feePlataforma + (b.adSpend || 0) + fixedCosts.total),
    };
  }

  if (section === 'cashflow') {
    extra.cashflow = {
      liquidable: Math.round(b.liquidable),
      pagosRecibidos: Math.round(b.pagosRecibidos),
      pagosPendientes: Math.round(b.pagosPendientes),
    };
    const upcoming = await CashflowEntry.aggregate([
      { $match: { storeId: sid, estado: 'pendiente' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$fechaPago' } }, total: { $sum: '$liquidable' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $limit: 7 },
    ]);
    if (upcoming.length) extra.cashflow.proximosPagos = upcoming;
  }

  if (section === 'productos') {
    const topProducts = await Order.aggregate([
      { $match: { storeId: sid, ...dateMatch, paymentStatus: 'paid' } },
      { $unwind: '$lineItems' },
      { $group: { _id: '$lineItems.nombre', vendidos: { $sum: '$lineItems.cantidad' }, revenue: { $sum: { $multiply: ['$lineItems.precioUnitario', '$lineItems.cantidad'] } } } },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);
    extra.topProductos = topProducts.map((p) => ({ nombre: p._id, vendidos: p.vendidos, revenue: Math.round(p.revenue) }));
  }

  if (section === 'clientes') {
    const segments = await Customer.aggregate([
      { $match: { storeId: sid, rfmSegment: { $exists: true } } },
      { $group: { _id: '$rfmSegment', count: { $sum: 1 }, totalRevenue: { $sum: '$totalSpent' }, avgLTV: { $avg: '$ltv' } } },
      { $sort: { totalRevenue: -1 } },
    ]);
    extra.segmentosRFM = segments;
    extra.totalClientes = await Customer.countDocuments({ storeId: sid });
  }

  if (section === 'meta' || section === 'creativos') {
    const campaigns = await MetaCampaign.find({ storeId: sid, level: 'campaign' }).lean();
    const campaignMetrics = [];
    for (const c of campaigns.slice(0, 10)) {
      const [ins] = await MetaDailyInsight.aggregate([
        { $match: { storeId: sid, metaId: c.metaId, ...dateMatch } },
        { $group: { _id: null, spend: { $sum: '$spend' }, impressions: { $sum: '$impressions' }, clicks: { $sum: '$clicks' }, purchases: { $sum: '$purchases' }, purchaseValue: { $sum: '$purchaseValue' } } },
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

  if (['creativos', 'competencia', 'report', 'topic-map', 'language-bank'].includes(section)) {
    const [topicMaps, hooks, objections, competitors] = await Promise.all([
      TopicMap.find({ storeId: sid }).sort({ updatedAt: -1 }).limit(12).lean(),
      LanguageBank.find({ storeId: sid, tipo: 'hook' }).sort({ updatedAt: -1 }).limit(12).lean(),
      LanguageBank.find({ storeId: sid, tipo: 'objecion' }).sort({ updatedAt: -1 }).limit(12).lean(),
      Competitor.find({ storeId: sid }).sort({ updatedAt: -1 }).limit(8).lean(),
    ]);

    extra.creativeFramework = {
      topics: topicMaps.map((item) => ({
        nombre: item.nombre,
        status: item.status,
        priority: item.priority,
        avatar: item.avatar,
        awarenessLevel: item.awarenessLevel,
        angle: item.angle,
        territory: item.territory,
        symptom: item.symptom,
        objection: item.objection,
        recommendedFormat: item.recommendedFormat,
        stage: item.stage,
        hypothesis: item.hypothesis,
        tags: item.tags || [],
        description: item.description,
        performanceNotes: item.performanceNotes,
      })),
      hooks: hooks.map((item) => ({
        texto: item.texto,
        avatar: item.avatar,
        awarenessLevel: item.awarenessLevel,
        angle: item.angle,
        territory: item.territory,
        tags: item.tags || [],
        sentiment: item.sentiment,
      })),
      objections: objections.map((item) => ({
        texto: item.texto,
        response: item.response,
        avatar: item.avatar,
        awarenessLevel: item.awarenessLevel,
        angle: item.angle,
        territory: item.territory,
        objectionStage: item.objectionStage,
        tags: item.tags || [],
      })),
      competitors: competitors.map((item) => ({
        nombre: item.nombre,
        url: item.url,
        positioning: item.positioning,
        avatar: item.avatar,
        awarenessLevel: item.awarenessLevel,
        mainOffer: item.mainOffer,
        angles: item.angles || [],
        territories: item.territories || [],
        objectionsDetected: item.objectionsDetected || [],
        notas: item.notas,
        analysisResult: item.analysisResult,
      })),
    };
  }

  if (section === 'topic-map') {
    extra.topicMapOverview = await getTopicMapOverview(storeId);
  }

  if (section === 'language-bank') {
    extra.languageBankOverview = await getLanguageBankOverview(storeId);
  }

  if (section === 'competencia') {
    extra.competitorOverview = await getCompetitorOverview(storeId);
  }

  // Store base info para que la IA externa pueda referirse al cliente correctamente
  const storeMeta = await Store.findById(storeId).select('nombre plataforma storeUrl objetivos').lean();
  if (storeMeta) {
    extra.store = {
      nombre: storeMeta.nombre,
      plataforma: storeMeta.plataforma,
      url: storeMeta.storeUrl,
      objetivos: storeMeta.objetivos || null,
    };
  }

  return { ...base, ...extra };
}

module.exports = {
  buildContext,
  getSectionPlaybook,
  BASE_SYSTEM_PROMPT,
  SECTION_PLAYBOOKS,
};
