const AutomationRule = require('../models/AutomationRule');
const Report = require('../models/Report');
const Store = require('../models/Store');
const { analyze } = require('./aiService');
const { aggregateRange } = require('./metricCalculator');
const { getFrameworkOverview, getCreativePipeline } = require('./creativeService');
const { getCommercialOverview } = require('./productService');
const { runDiagnostics } = require('./diagnosticsService');

const TYPE_CONFIG = {
  executive_summary: {
    section: 'dashboard',
    title: 'Resumen ejecutivo automatizado',
    summary: 'Resumen ejecutivo con foco en revenue, profit, liquidez y salud general.',
  },
  anomaly_watch: {
    section: 'diagnostics',
    title: 'Vigilancia de anomalías',
    summary: 'Chequeo automatizado de alertas, desvíos y riesgos del período.',
  },
  creative_review: {
    section: 'creativos',
    title: 'Revisión creativa',
    summary: 'Resumen automatizado del frente creativo y framework estratégico.',
  },
  catalog_health: {
    section: 'productos',
    title: 'Salud comercial del catálogo',
    summary: 'Chequeo comercial y de surtido sobre productos, stock y retorno.',
  },
};

function formatDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function getDateRange(daysBack = 7) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - Math.max(1, Number(daysBack) || 7));
  return { from: formatDate(from), to: formatDate(to) };
}

function isRuleDue(rule, now = new Date()) {
  if (!rule.active) return false;
  if (rule.frequency === 'manual') return false;
  if (!rule.lastRunAt) return true;

  const lastRun = new Date(rule.lastRunAt);
  const diffMs = now.getTime() - lastRun.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (rule.frequency === 'daily') return diffHours >= 20;
  if (rule.frequency === 'weekly') return diffHours >= 24 * 6;
  return false;
}

function buildFallbackAnalysis(rule, snapshot, from, to) {
  const metrics = snapshot?.metrics || {};
  const lines = [
    `# ${TYPE_CONFIG[rule.type]?.title || 'Automatización'}`,
    '',
    `Período: ${from} a ${to}`,
    '',
  ];

  if (metrics && Object.keys(metrics).length > 0) {
    lines.push('## Resumen');
    lines.push(`- Revenue: ${Math.round(metrics.revenue || 0).toLocaleString('es-AR')}`);
    lines.push(`- Profit: ${Math.round(metrics.profit || 0).toLocaleString('es-AR')}`);
    lines.push(`- Ad Spend: ${Math.round(metrics.adSpend || 0).toLocaleString('es-AR')}`);
    lines.push(`- Órdenes: ${(metrics.ordenes || 0).toLocaleString('es-AR')}`);
    lines.push(`- ROAS: ${Number(metrics.roas || 0).toFixed(2)}x`);
    lines.push(`- True ROAS: ${Number(metrics.trueRoas || 0).toFixed(2)}x`);
  }

  if (snapshot?.commercial?.summary) {
    lines.push('', '## Comercial');
    lines.push(`- Productos: ${snapshot.commercial.summary.totalProducts || 0}`);
    lines.push(`- Stock valorizado: ${Math.round(snapshot.commercial.summary.stockValue || 0).toLocaleString('es-AR')}`);
    lines.push(`- Dead stock: ${snapshot.commercial.summary.deadStockCount || 0}`);
  }

  if (snapshot?.framework?.summary) {
    lines.push('', '## Framework creativo');
    lines.push(`- Topics: ${snapshot.framework.summary.topics || 0}`);
    lines.push(`- Hooks: ${snapshot.framework.summary.hooks || 0}`);
    lines.push(`- Objeciones sin respuesta: ${snapshot.framework.summary.unresolvedObjections || 0}`);
  }

  if (snapshot?.pipeline?.summary) {
    lines.push('', '## Pipeline creativo');
    lines.push(`- Escalar: ${snapshot.pipeline.summary.escalar || 0}`);
    lines.push(`- Pausar: ${snapshot.pipeline.summary.pausar || 0}`);
    lines.push(`- Testear: ${snapshot.pipeline.summary.testear || 0}`);
    if (snapshot.pipeline.escalar?.[0]) {
      lines.push(`- Principal para escalar: ${snapshot.pipeline.escalar[0].title}`);
    }
    if (snapshot.pipeline.testear?.[0]) {
      lines.push(`- Próximo test sugerido: ${snapshot.pipeline.testear[0].title}`);
    }
  }

  lines.push('', '## Nota');
  lines.push('- Reporte generado en modo local sin proveedor AI configurado.');

  return {
    analysis: lines.join('\n'),
    confidence: snapshot?.metrics?.sourceCoverage?.confidence ?? 0.35,
    qualityNote: 'Automatización ejecutada con fallback local porque no hay API key configurada.',
    tokensUsed: 0,
    model: 'local-fallback',
    provider: 'local',
    generationMode: 'fallback',
  };
}

async function buildSnapshot(rule, storeId, from, to) {
  if (rule.type === 'creative_review') {
    return {
      framework: await getFrameworkOverview(storeId),
      pipeline: await getCreativePipeline(storeId, from, to),
      metrics: await aggregateRange(storeId, from, to),
    };
  }

  if (rule.type === 'catalog_health') {
    return {
      commercial: await getCommercialOverview(storeId, from, to),
      metrics: await aggregateRange(storeId, from, to),
    };
  }

  return {
    metrics: await aggregateRange(storeId, from, to),
  };
}

async function runRule(rule, userId) {
  const { from, to } = getDateRange(rule.config?.fromDaysBack);
  const snapshot = await buildSnapshot(rule, rule.storeId, from, to);

  if (rule.type === 'anomaly_watch') {
    const store = await Store.findById(rule.storeId);
    if (store) {
      await runDiagnostics(store);
    }
  }

  const typeConfig = TYPE_CONFIG[rule.type] || TYPE_CONFIG.executive_summary;
  let result;
  try {
    result = await analyze(typeConfig.section, rule.storeId, from, to, userId, { purpose: 'reports' });
  } catch (error) {
    if (!String(error.message || '').includes('API key')) {
      throw error;
    }
    result = buildFallbackAnalysis(rule, snapshot, from, to);
  }

  const report = await Report.create({
    storeId: rule.storeId,
    tipo: 'report',
    titulo: `${typeConfig.title} · ${new Date().toLocaleDateString('es-AR')}`,
    contenido: result.analysis,
    section: typeConfig.section,
    summary: typeConfig.summary,
    dateRange: { from: new Date(from), to: new Date(to) },
    snapshot,
    tokensUsed: result.tokensUsed || 0,
    model: result.model,
    provider: result.provider || null,
    confidence: result.confidence ?? null,
    qualityNote: result.qualityNote || '',
    generationMode: result.generationMode || (result.provider ? 'ai' : 'fallback'),
  });

  rule.lastRunAt = new Date();
  rule.lastStatus = 'success';
  rule.lastError = '';
  rule.lastReportId = report._id;
  await rule.save();

  return { rule, report, result };
}

function getIntegrationCatalog(store) {
  const tiendanubeConnected = !!store.integrationStatus?.tiendanube?.connected;
  const metaConnected = !!store.integrationStatus?.metaAds?.connected;

  return [
    {
      key: 'tiendanube',
      name: 'Tienda Nube',
      status: tiendanubeConnected ? 'connected' : 'disconnected',
      mode: 'manual_token',
      available: true,
      lastSync: store.integrationStatus?.tiendanube?.lastSync || null,
      readiness: tiendanubeConnected ? 'ready' : 'setup_required',
      nextStep: tiendanubeConnected ? 'Sincronizar cuando haga falta' : 'Conectar access token y store id',
    },
    {
      key: 'meta_ads',
      name: 'Meta Ads',
      status: metaConnected ? 'connected' : 'disconnected',
      mode: 'api_or_csv',
      available: true,
      lastSync: store.integrationStatus?.metaAds?.lastSync || null,
      readiness: metaConnected ? 'ready' : 'setup_required',
      nextStep: metaConnected ? 'Revisar campañas y sync' : 'Conectar cuenta o importar CSV',
    },
    {
      key: 'google_ads',
      name: 'Google Ads',
      status: 'planned',
      mode: 'future_connector',
      available: false,
      lastSync: null,
      readiness: 'planned',
      nextStep: 'Definir conector y normalización de campañas',
    },
    {
      key: 'tiktok_ads',
      name: 'TikTok Ads',
      status: 'planned',
      mode: 'future_connector',
      available: false,
      lastSync: null,
      readiness: 'planned',
      nextStep: 'Agregar fuente de tráfico y creatividad',
    },
    {
      key: 'shopify',
      name: 'Shopify',
      status: 'planned',
      mode: 'future_connector',
      available: false,
      lastSync: null,
      readiness: 'planned',
      nextStep: 'Modelar órdenes, catálogo y customers',
    },
    {
      key: 'mercadolibre',
      name: 'MercadoLibre',
      status: 'planned',
      mode: 'future_connector',
      available: false,
      lastSync: null,
      readiness: 'planned',
      nextStep: 'Separar canal marketplace del canal e-commerce propio',
    },
    {
      key: 'google_sheets',
      name: 'Google Sheets',
      status: 'planned',
      mode: 'future_connector',
      available: false,
      lastSync: null,
      readiness: 'planned',
      nextStep: 'Usar como fuente controlada para cargas manuales',
    },
  ];
}

async function runDueRulesForStore(storeId, userId = null, now = new Date()) {
  const rules = await AutomationRule.find({ storeId, active: true });
  const dueRules = rules.filter((rule) => isRuleDue(rule, now));
  const results = [];

  for (const rule of dueRules) {
    try {
      const result = await runRule(rule, userId);
      results.push({ ruleId: rule._id, status: 'success', reportId: result.report._id });
    } catch (error) {
      rule.lastRunAt = new Date();
      rule.lastStatus = 'error';
      rule.lastError = error.message;
      await rule.save();
      results.push({ ruleId: rule._id, status: 'error', error: error.message });
    }
  }

  return {
    total: dueRules.length,
    success: results.filter((item) => item.status === 'success').length,
    error: results.filter((item) => item.status === 'error').length,
    results,
  };
}

async function runDueRulesForAllStores(now = new Date()) {
  const stores = await Store.find({}).select('_id');
  let total = 0;
  let success = 0;
  let error = 0;

  for (const store of stores) {
    const result = await runDueRulesForStore(store._id, null, now);
    total += result.total;
    success += result.success;
    error += result.error;
  }

  return { stores: stores.length, total, success, error };
}

module.exports = {
  AutomationRule,
  runRule,
  getDateRange,
  getIntegrationCatalog,
  isRuleDue,
  runDueRulesForStore,
  runDueRulesForAllStores,
};
