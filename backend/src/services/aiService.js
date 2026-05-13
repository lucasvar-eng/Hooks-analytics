const { ai } = require('../config/environment');
const { getProvider } = require('./aiProviders');
const { decrypt } = require('../utils/encryption');
const User = require('../models/User');
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
const mongoose = require('mongoose');
const { getEffectiveTarget } = require('./targetService');
const { getDataAudit } = require('./tiendaService');
const { getFixedCostsForRange } = require('./fixedCostService');
const {
  getTopicMapOverview,
  getLanguageBankOverview,
  getCompetitorOverview,
} = require('./contentStrategyService');
const { buildBusinessDateKeyMatch } = require('../utils/businessDate');
const logger = require('../utils/logger');

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

/**
 * Resolve AI credentials for a user (user key → env fallback).
 */
async function resolveCredentials(userId) {
  if (userId) {
    const user = await User.findById(userId)
      .select('+aiConfig.apiKeyEncrypted +aiConfig.apiKeyIV +aiConfig.apiKeyAuthTag aiConfig.provider aiConfig.modelAnalysis aiConfig.modelChat aiConfig.modelReports');

    if (user?.aiConfig?.apiKeyEncrypted) {
      const apiKey = decrypt(
        user.aiConfig.apiKeyEncrypted,
        user.aiConfig.apiKeyIV,
        user.aiConfig.apiKeyAuthTag
      );
      return {
        provider: user.aiConfig.provider || 'anthropic',
        apiKey,
        modelAnalysis: user.aiConfig.modelAnalysis || ai.modelAnalysis,
        modelChat: user.aiConfig.modelChat || ai.modelChat,
        modelReports: user.aiConfig.modelReports || ai.modelReports,
        source: 'user',
      };
    }
  }

  if (ai.anthropicApiKey) {
    return {
      provider: 'anthropic',
      apiKey: ai.anthropicApiKey,
      modelAnalysis: ai.modelAnalysis,
      modelChat: ai.modelChat,
      modelReports: ai.modelReports,
      source: 'env',
    };
  }

  if (ai.openaiApiKey) {
    return {
      provider: 'openai',
      apiKey: ai.openaiApiKey,
      modelAnalysis: ai.modelAnalysis,
      modelChat: ai.modelChat,
      modelReports: ai.modelReports,
      source: 'env',
    };
  }

  throw new Error('No hay API key de AI configurada. Configurala en tu perfil o en .env');
}

function pickModel(credentials, purpose = 'analysis') {
  if (purpose === 'reports') return credentials.modelReports || credentials.modelAnalysis;
  if (purpose === 'chat') return credentials.modelChat;
  return credentials.modelAnalysis;
}

/**
 * Build the full system prompt merging base + user global + store instructions.
 */
async function buildSystemPrompt(userId, storeId) {
  let prompt = BASE_SYSTEM_PROMPT;

  // User global instructions
  if (userId) {
    const user = await User.findById(userId)
      .select('aiConfig.globalInstructions')
      .populate({ path: 'aiConfig.globalFiles', select: 'filename content' });

    // Re-fetch with file content since select: false
    const userFull = await User.findById(userId).select('+aiConfig.globalFiles.content aiConfig.globalInstructions');

    if (userFull?.aiConfig?.globalInstructions) {
      prompt += `\n\n--- Instrucciones globales del usuario ---\n${userFull.aiConfig.globalInstructions}`;
    }
    if (userFull?.aiConfig?.globalFiles?.length) {
      for (const f of userFull.aiConfig.globalFiles) {
        if (f.content) {
          prompt += `\n\n--- Archivo: ${f.filename} ---\n${f.content}`;
        }
      }
    }
  }

  // Store-specific instructions
  if (storeId) {
    const store = await Store.findById(storeId).select('aiContext nombre');
    if (store?.aiContext?.instructions) {
      prompt += `\n\n--- Instrucciones de la tienda "${store.nombre}" ---\n${store.aiContext.instructions}`;
    }
    if (store?.aiContext?.files?.length) {
      for (const f of store.aiContext.files) {
        if (f.content) {
          prompt += `\n\n--- Archivo tienda: ${f.filename} ---\n${f.content}`;
        }
      }
    }
  }

  // Safety: truncate if too long (30K chars max for system prompt)
  if (prompt.length > 30000) {
    prompt = prompt.substring(0, 30000) + '\n\n[Contexto truncado por límite de tamaño]';
  }

  return prompt;
}

/**
 * Build data context for a specific section.
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

  return { ...base, ...extra };
}

function getSectionInstructions(section) {
  const playbook = SECTION_PLAYBOOKS[section] || SECTION_PLAYBOOKS.dashboard;
  return `Objetivo: ${playbook.objective}.
Incluí sí o sí: ${playbook.mustInclude.join(', ')}.
Si la confianza del dato no es alta, decilo explícitamente y evitá recomendar escalar fuerte o tomar decisiones irreversibles.`;
}

function buildAnalysisPrompt(section, context) {
  return `${getSectionInstructions(section)}

Respondé en markdown y usá esta estructura:
## Diagnóstico
## Qué está funcionando
## Riesgos o límites del dato
## Acciones prioritarias

Reglas:
- no inventes números
- no repitas todo el contexto
- si falta data clave, tratala como limitación operativa
- si la confianza es baja, decí qué NO harías todavía

Datos:
${JSON.stringify(context, null, 2)}`;
}

function parseRatioValue(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[^\d.,-]/g, '').replace(',', '.');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildFallbackStructuredInsights(section, context) {
  const insights = [];
  const add = (item) => {
    if (item?.titulo && insights.length < 8) insights.push(item);
  };

  if (section === 'meta') {
    const spend = Number(context.adSpend || 0);
    const purchases = Number(context.metaPurchases || 0);
    const roas = parseRatioValue(context.roas);
    const ctr = parseRatioValue(context.ctr);

    if (spend <= 0) {
      add({
        titulo: 'No hay inversión publicitaria registrada',
        descripcion: 'La sección Meta no muestra gasto en el período. Antes de evaluar performance, confirmá si no hubo inversión o si falta sincronización.',
        tipo: 'diagnostic',
        severidad: 'warning',
        verdict: 'REVISAR',
        metricKey: 'adSpend',
      });
    } else if (purchases <= 0) {
      add({
        titulo: 'Hay spend sin compras atribuidas',
        descripcion: `Se registraron ${Math.round(spend).toLocaleString('es-AR')} de inversión sin compras Meta atribuidas en el período.`,
        tipo: 'alert',
        severidad: 'critical',
        verdict: 'REVISAR',
        metricKey: 'metaPurchases',
      });
    } else if (roas >= 2) {
      add({
        titulo: 'La adquisición muestra una base rentable',
        descripcion: `El ROAS del período quedó en ${roas.toFixed(2)}x con ${purchases.toLocaleString('es-AR')} compras atribuidas. Hay señal para identificar campañas escalables.`,
        tipo: 'win',
        severidad: 'positive',
        verdict: 'ESCALAR',
        metricKey: 'roas',
      });
    } else {
      add({
        titulo: 'La eficiencia de adquisición todavía es frágil',
        descripcion: `El ROAS del período quedó en ${roas.toFixed(2)}x. Conviene separar campañas sostenibles de campañas que solo consumen presupuesto.`,
        tipo: 'diagnostic',
        severidad: 'warning',
        verdict: 'REVISAR',
        metricKey: 'roas',
      });
    }

    if (ctr > 0 && ctr < 1) {
      add({
        titulo: 'CTR bajo para la inversión actual',
        descripcion: `El CTR de la cuenta está en ${ctr.toFixed(2)}%. Puede haber fatiga creativa o un problema de propuesta inicial.`,
        tipo: 'alert',
        severidad: 'warning',
        verdict: 'TESTEAR',
        metricKey: 'ctr',
      });
    }

    add({
      titulo: 'Bajar a campañas con gasto real',
      descripcion: 'La lectura útil en Meta empieza por campañas con spend y volumen. Evitá sacar conclusiones sobre estructuras sin delivery.',
      tipo: 'action_item',
      severidad: 'diagnostic',
      verdict: 'IMPLEMENTAR',
      metricKey: 'campaigns',
    });
  } else if (section === 'dashboard') {
    const revenue = Number(context.revenue || 0);
    const profit = Number(context.adjustedProfit ?? context.profit ?? 0);
    const orders = Number(context.ordenesPositivas || 0);
    const ncPct = parseRatioValue(context.ncPct);

    add({
      titulo: 'Foto ejecutiva del período',
      descripcion: `La tienda cerró con ${orders.toLocaleString('es-AR')} órdenes positivas, ${Math.round(revenue).toLocaleString('es-AR')} de facturación y ${Math.round(profit).toLocaleString('es-AR')} de ganancia ajustada.`,
      tipo: 'diagnostic',
      severidad: 'diagnostic',
      verdict: null,
      metricKey: 'revenue',
    });

    if (ncPct >= 80 && orders > 0) {
      add({
        titulo: 'Dependencia alta de nuevos clientes',
        descripcion: `El mix actual muestra ${ncPct.toFixed(1)}% de órdenes de nuevos clientes. Conviene revisar recompra y calidad de base.`,
        tipo: 'alert',
        severidad: 'warning',
        verdict: 'REVISAR',
        metricKey: 'ncPct',
      });
    }
  } else {
    add({
      titulo: 'Lectura rápida disponible',
      descripcion: 'La sección no tiene AI paga activa, así que se generó un diagnóstico local de respaldo para no dejarla vacía.',
      tipo: 'diagnostic',
      severidad: 'diagnostic',
      verdict: null,
      metricKey: null,
    });
  }

  return {
    summary: `Fallback local para ${section}`,
    confidence: context?.dataQuality?.confidence ?? 0.45,
    insights,
    tokensUsed: 0,
    model: 'local-fallback',
    provider: 'local',
    context,
  };
}

async function structuredInsights(section, storeId, from, to, userId) {
  const credentials = await resolveCredentials(userId);
  const provider = getProvider(credentials.provider, credentials.apiKey);
  const systemPrompt = await buildSystemPrompt(userId, storeId);
  const context = await buildContext(section, storeId, from, to);

  const prompt = `Generá un JSON válido con esta forma exacta:
{"summary":"string","confidence":0.0,"insights":[{"titulo":"string","descripcion":"string","tipo":"alert|win|diagnostic|action_item|verdict|note","severidad":"critical|warning|positive|neutral|diagnostic|verdict","verdict":"ESCALAR|PAUSAR|TESTEAR|REVISAR|IMPLEMENTAR|MANTENER|null","metricKey":"string|null","impacto":"string|null"}]}

Reglas:
- confidence debe reflejar la calidad del dato y estar entre 0 y 1
- máximo 8 insights
- no inventes números
- si la confianza es baja, reflejalo en summary y en los insights

Instrucciones sección:
${getSectionInstructions(section)}

Datos:
${JSON.stringify(context, null, 2)}`;

  const result = await provider.createMessage({
    model: pickModel(credentials, 'analysis'),
    maxTokens: 1800,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('La AI no devolvió un JSON interpretable');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    summary: parsed.summary || '',
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? context.dataQuality?.confidence ?? 0.5))),
    insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 8) : [],
    tokensUsed: result.usage.inputTokens + result.usage.outputTokens,
    model: pickModel(credentials, 'analysis'),
    provider: credentials.provider,
    context,
  };
}

async function generateWorkflow(type, storeId, from, to, userId, extra = {}) {
  const credentials = await resolveCredentials(userId);
  const provider = getProvider(credentials.provider, credentials.apiKey);
  const systemPrompt = await buildSystemPrompt(userId, storeId);
  const section = type === 'competitor_opportunities' ? 'competencia' : 'creativos';
  const context = await buildContext(section, storeId, from, to);

  const workflowPrompts = {
    creative_brief: `Respondé SOLO JSON válido con esta forma:
{"title":"string","confidence":0.0,"ideas":[{"hook":"string","angle":"string","format":"string","why":"string","priority":"high|medium|low"}]}

Objetivo:
- Proponer entre 4 y 8 ideas creativas accionables
- Usar hooks, objeciones, topics y señales de performance
- No inventar métricas
- Priorizar ideas que cubran objeciones desatendidas y territorios subexplotados`,
    competitor_opportunities: `Respondé SOLO JSON válido con esta forma:
{"title":"string","confidence":0.0,"opportunities":[{"title":"string","gap":"string","action":"string","priority":"high|medium|low"}]}

Objetivo:
- Detectar entre 4 y 8 oportunidades concretas frente al competidor
- Usar solo el contexto provisto
- Si el contexto del competidor es limitado, decirlo y bajar la confianza`,
  };

  const prompt = `${workflowPrompts[type]}

Extra:
${JSON.stringify(extra, null, 2)}

Datos:
${JSON.stringify(context, null, 2)}`;

  const result = await provider.createMessage({
    model: pickModel(credentials, 'reports'),
    maxTokens: 1800,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('La AI no devolvió un JSON interpretable');

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    ...parsed,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? context.dataQuality?.confidence ?? 0.5))),
    tokensUsed: result.usage.inputTokens + result.usage.outputTokens,
    model: pickModel(credentials, 'reports'),
    provider: credentials.provider,
  };
}

/**
 * Generate AI analysis for a section.
 */
async function analyze(section, storeId, from, to, userId, options = {}) {
  const credentials = await resolveCredentials(userId);
  const provider = getProvider(credentials.provider, credentials.apiKey);
  const systemPrompt = await buildSystemPrompt(userId, storeId);
  const context = await buildContext(section, storeId, from, to);
  const purpose = options.purpose || (section === 'report' ? 'reports' : 'analysis');
  const model = pickModel(credentials, purpose);

  const prompt = buildAnalysisPrompt(section, context);

  const result = await provider.createMessage({
    model,
    maxTokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  });

  return {
    analysis: result.text,
    confidence: context.dataQuality?.confidence ?? 0.5,
    qualityNote: context.dataQuality?.note,
    contextMeta: {
      sourceCoverage: context.sourceCoverage,
      targets: context.targets ? true : false,
      credentialSource: credentials.source,
    },
    tokensUsed: result.usage.inputTokens + result.usage.outputTokens,
    model,
    provider: credentials.provider,
    generationMode: 'ai',
  };
}

/**
 * Chat with AI about store data.
 */
async function chat(messages, storeId, from, to, userId, section = 'dashboard') {
  const credentials = await resolveCredentials(userId);
  const provider = getProvider(credentials.provider, credentials.apiKey);
  const systemPrompt = await buildSystemPrompt(userId, storeId);
  const context = await buildContext(section, storeId, from, to);

  const fullSystem = `${systemPrompt}

Sección activa: ${section}
Contexto de la tienda en el período seleccionado:
${JSON.stringify(context, null, 2)}

Reglas extra:
- Si el usuario pide ideas creativas, usá topic maps, hooks, objeciones y competencia si están disponibles.
- Si la calidad del dato no es alta, decilo antes de sacar conclusiones fuertes.
- Si te preguntan algo que no podés determinar con estos datos, decilo claramente.`;

  const result = await provider.createMessage({
    model: pickModel(credentials, 'chat'),
    maxTokens: 1000,
    system: fullSystem,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  return {
    response: result.text,
    tokensUsed: result.usage.inputTokens + result.usage.outputTokens,
    provider: credentials.provider,
    model: pickModel(credentials, 'chat'),
    confidence: context.dataQuality?.confidence ?? 0.5,
    qualityNote: context.dataQuality?.note || '',
    contextMeta: {
      sourceCoverage: context.sourceCoverage,
      credentialSource: credentials.source,
    },
  };
}

/**
 * Test API connection using user's credentials.
 */
async function testConnection(userId) {
  const credentials = await resolveCredentials(userId);
  const provider = getProvider(credentials.provider, credentials.apiKey);
  const testModel = credentials.provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini';

  await provider.createMessage({
    model: testModel,
    maxTokens: 10,
    system: 'Respond OK',
    messages: [{ role: 'user', content: 'test' }],
  });

  return { status: 'ok', provider: credentials.provider, source: credentials.source };
}

module.exports = { analyze, chat, testConnection, structuredInsights, buildContext, generateWorkflow, buildFallbackStructuredInsights };
