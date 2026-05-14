/**
 * Catálogo de templates de reportes (Sprint 2 — MCP-first).
 *
 * Cada template es un BRIEFING para una IA externa que entra vía MCP:
 *  - structure[]:    secciones obligatorias con título + guidance + checklist
 *  - metricsBlock:   datos pre-calculados que la IA cita SIN recalcular
 *  - contextRefs[]:  resources MCP que la IA debería leer para completar bien
 *  - systemPromptHint: tono y reglas específicas del template
 *
 * Filosofía: la IA externa no escribe en el aire. Recibe un esqueleto + datos
 * duros y los completa. El reporte final lo sube via MCP `create_report` o REST
 * `POST /reports`.
 *
 * NO mezcla métricas reales con texto hardcoded como hacía la versión vieja
 * (eso es lo que rompía: parecía análisis pero era plantilla genérica).
 */
const Store = require('../models/Store');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const { buildContext } = require('./aiService');
const mongoose = require('mongoose');

// ============================================================================
// Helpers de formato (solo para el metricsBlock)
// ============================================================================

function fmtMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return '$0';
  return `$${Math.round(Number(value)).toLocaleString('es-AR')}`;
}
function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '$0';
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
function fmtNum(v) {
  if (v == null || isNaN(v)) return '0';
  return Number(v).toLocaleString('es-AR');
}
function fmtRatio(v) {
  if (v == null || v === 'Sin datos') return 'Sin datos';
  if (typeof v === 'string' && v.endsWith('x')) return v;
  const n = Number(v);
  if (Number.isNaN(n)) return 'Sin datos';
  return `${n.toFixed(2)}x`;
}
function fmtPct(v) {
  if (v == null) return '0%';
  if (typeof v === 'string') return v;
  return `${Number(v).toFixed(1)}%`;
}
function fmtDateRange(from, to) {
  return `${from || 'inicio'} a ${to || 'hoy'}`;
}

// ============================================================================
// Cálculos de período comparativo (esta semana vs anterior, este mes vs anterior)
// ============================================================================

function daysBetween(from, to) {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000)) + 1;
}

function shiftRange(from, to, daysBack) {
  if (!from || !to) return { from: null, to: null };
  const fromD = new Date(from);
  const toD = new Date(to);
  fromD.setDate(fromD.getDate() - daysBack);
  toD.setDate(toD.getDate() - daysBack);
  return {
    from: fromD.toISOString().slice(0, 10),
    to: toD.toISOString().slice(0, 10),
  };
}

function computeDelta(current, previous) {
  if (current == null || previous == null) return null;
  if (typeof current === 'string' || typeof previous === 'string') return null;
  if (previous === 0) return current > 0 ? 'nuevo' : 'sin cambio';
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return { absoluto: current - previous, pct: Number(pct.toFixed(1)) };
}

// ============================================================================
// metricsBlock builders por template
// ============================================================================

async function buildBaseMetricsBlock(storeId, from, to) {
  const context = await buildContext('dashboard', storeId, from, to);
  return {
    periodo: context.periodo,
    revenue: { valor: context.revenue, display: fmtMoney(context.revenue) },
    netRevenue: { valor: context.netRevenue, display: fmtMoney(context.netRevenue) },
    profit: { valor: context.adjustedProfit, display: fmtMoney(context.adjustedProfit) },
    profitMargin: { valor: context.adjustedProfitMargin, display: context.adjustedProfitMargin },
    ordenes: { valor: context.ordenesPositivas, display: fmtNum(context.ordenesPositivas) },
    aov: { valor: context.aov, display: fmtMoney(context.aov) },
    adSpend: { valor: context.adSpend, display: fmtMoney(context.adSpend) },
    roas: { valor: context.roas, display: fmtRatio(context.roas) },
    trueRoas: { valor: context.trueRoas, display: fmtRatio(context.trueRoas) },
    cpa: { valor: context.cpa, display: typeof context.cpa === 'number' ? fmtMoney(context.cpa) : 'Sin datos' },
    ncPct: { valor: context.ncPct, display: context.ncPct },
    devoluciones: { valor: context.devoluciones, display: fmtNum(context.devoluciones) },
    dataQuality: context.dataQuality || {},
    sourceCoverage: context.sourceCoverage || {},
    targets: context.targets || null,
    _rawContext: context, // por si la IA quiere más detalle
  };
}

async function buildComparativeBlock(storeId, from, to) {
  if (!from || !to) {
    return { current: await buildBaseMetricsBlock(storeId, from, to), previous: null, deltas: null };
  }
  const days = daysBetween(from, to);
  const prev = shiftRange(from, to, days);
  const [current, previous] = await Promise.all([
    buildContext('dashboard', storeId, from, to),
    buildContext('dashboard', storeId, prev.from, prev.to),
  ]);

  const deltas = {
    revenue: computeDelta(current.revenue, previous.revenue),
    profit: computeDelta(current.adjustedProfit, previous.adjustedProfit),
    ordenes: computeDelta(current.ordenesPositivas, previous.ordenesPositivas),
    aov: computeDelta(current.aov, previous.aov),
    adSpend: computeDelta(current.adSpend, previous.adSpend),
  };

  return { current, previous, deltas, prevRange: prev };
}

// ============================================================================
// Templates — los 5 Tier 1
// ============================================================================

const TEMPLATES = {
  // --------------------------------------------------------------------------
  executive: {
    key: 'executive',
    label: 'Reporte ejecutivo',
    description: 'Foto ejecutiva del período: facturación, ganancia, ROAS, riesgos y 2-3 acciones priorizadas.',
    section: 'dashboard',
    frequency: 'on-demand',
    audience: 'gerencial',
    contextNeeded: ['dashboard'],
    contextRefs: [
      'GET /api/stores/:storeId/metrics?from=:from&to=:to',
      'MCP resource hooks://stores/:storeId/ai-context?section=dashboard',
    ],
    systemPromptHint: 'Sé directo, accionable, máximo 400 palabras. Citá números específicos del metricsBlock. Cerrá con 2-3 acciones priorizadas. Si la confianza del dato no es alta, decilo explícitamente.',
    structure: [
      {
        id: 'resumen',
        title: 'Resumen ejecutivo',
        type: 'narrative',
        guidance: 'Una sola frase con el dato más importante del período. Foto del negocio: facturación + ganancia + ROAS. Si el margen ajustado es < 20% o ROAS < 2x, marcá como zona amarilla; si negativo o muy bajo, rojo.',
        maxWords: 60,
      },
      {
        id: 'foto',
        title: 'Foto del negocio',
        type: 'metrics-table',
        guidance: 'Tabla limpia citando exactamente los valores del metricsBlock. No interpretes acá, solo listá.',
        metricsToCite: ['revenue', 'netRevenue', 'profit', 'profitMargin', 'adSpend', 'trueRoas', 'aov', 'ncPct'],
      },
      {
        id: 'lectura',
        title: 'Qué pasó y por qué importa',
        type: 'narrative',
        guidance: 'Identificá la principal palanca de resultado (adquisición / conversión / recompra). Si NC% > 80%, hay riesgo de dependencia de ads. Si margin < target, costos están comiendo el resultado.',
        checklist: [
          'Identificar palanca dominante (adquisición / conversión / recompra)',
          'Nombrar 1 riesgo estructural si hay alguno',
          'Mencionar nivel de confianza del dato si < 80%',
        ],
        maxWords: 140,
      },
      {
        id: 'acciones',
        title: 'Acciones priorizadas',
        type: 'action-list',
        guidance: 'De 2 a 3 acciones concretas para esta semana. Cada una: qué hacer + página del dashboard donde validar + outcome esperado.',
        minItems: 2,
        maxItems: 3,
      },
    ],
    buildMetricsBlock: async (storeId, from, to) => {
      const base = await buildBaseMetricsBlock(storeId, from, to);
      const storeMeta = await Store.findById(storeId).select('nombre').lean();
      return { ...base, store: { nombre: storeMeta?.nombre || 'Tienda' } };
    },
    buildTitle: (storeName, from, to) => `Reporte ejecutivo · ${storeName} · ${fmtDateRange(from, to)}`,
  },

  // --------------------------------------------------------------------------
  'weekly-review': {
    key: 'weekly-review',
    label: 'Revisión semanal',
    description: 'Esta semana vs la anterior — qué cambió, qué importa, qué hacer la semana que viene.',
    section: 'dashboard',
    frequency: 'weekly',
    audience: 'operativo',
    contextNeeded: ['dashboard', 'meta', 'productos'],
    contextRefs: [
      'GET /api/stores/:storeId/metrics?from=:from&to=:to (esta semana)',
      'GET /api/stores/:storeId/metrics?from=:prevFrom&to=:prevTo (semana anterior — viene en metricsBlock.previous)',
      'MCP resource hooks://stores/:storeId/ai-context?section=dashboard',
    ],
    systemPromptHint: 'Foco en MOVIMIENTOS (qué cambió) más que en valores absolutos. Si delta < 10% no merece atención. Si delta > 25% siempre comentalo. Cerrá con plan de la semana que viene.',
    structure: [
      {
        id: 'titular',
        title: 'Titular de la semana',
        type: 'narrative',
        guidance: 'Una sola frase con lo más relevante del cambio semana a semana. Ej: "Revenue creció 12% por mejor ROAS sin cambiar spend".',
        maxWords: 30,
      },
      {
        id: 'cambios',
        title: 'Qué cambió',
        type: 'comparison-table',
        guidance: 'Tabla con esta semana vs anterior para revenue, profit, ordenes, AOV, adSpend, ROAS. Marcá con flecha + color si delta > 10%.',
        metricsToCite: ['revenue', 'profit', 'ordenes', 'aov', 'adSpend'],
      },
      {
        id: 'movimientos',
        title: '3 movimientos relevantes',
        type: 'narrative',
        guidance: 'Identificá los 3 cambios de mayor impacto. Para cada uno: qué pasó, magnitud, posible causa, requiere acción inmediata sí/no.',
        checklist: [
          'Si revenue cayó >15%, explicar causa antes de seguir',
          'Si spend subió pero ROAS no acompañó, alertar como riesgo',
          'Si órdenes RC bajaron, mirar cohortes',
          'Si AOV cambió >10%, mencionar si hubo cambio de mix de producto',
        ],
        maxWords: 180,
      },
      {
        id: 'plan',
        title: 'Plan de la semana que viene',
        type: 'action-list',
        guidance: 'De 3 a 5 acciones específicas. Cada una con: qué hacer, día sugerido, página del dashboard para validar resultado.',
        minItems: 3,
        maxItems: 5,
      },
    ],
    buildMetricsBlock: async (storeId, from, to) => {
      const comparative = await buildComparativeBlock(storeId, from, to);
      const storeMeta = await Store.findById(storeId).select('nombre').lean();
      return {
        store: { nombre: storeMeta?.nombre || 'Tienda' },
        periodo: comparative.current?.periodo,
        periodoAnterior: comparative.prevRange ? fmtDateRange(comparative.prevRange.from, comparative.prevRange.to) : null,
        current: comparative.current
          ? {
              revenue: { valor: comparative.current.revenue, display: fmtMoney(comparative.current.revenue) },
              profit: { valor: comparative.current.adjustedProfit, display: fmtMoney(comparative.current.adjustedProfit) },
              ordenes: { valor: comparative.current.ordenesPositivas, display: fmtNum(comparative.current.ordenesPositivas) },
              aov: { valor: comparative.current.aov, display: fmtMoney(comparative.current.aov) },
              adSpend: { valor: comparative.current.adSpend, display: fmtMoney(comparative.current.adSpend) },
              roas: { valor: comparative.current.roas, display: fmtRatio(comparative.current.roas) },
              ncPct: { display: comparative.current.ncPct },
            }
          : null,
        previous: comparative.previous
          ? {
              revenue: { valor: comparative.previous.revenue, display: fmtMoney(comparative.previous.revenue) },
              profit: { valor: comparative.previous.adjustedProfit, display: fmtMoney(comparative.previous.adjustedProfit) },
              ordenes: { valor: comparative.previous.ordenesPositivas, display: fmtNum(comparative.previous.ordenesPositivas) },
              aov: { valor: comparative.previous.aov, display: fmtMoney(comparative.previous.aov) },
              adSpend: { valor: comparative.previous.adSpend, display: fmtMoney(comparative.previous.adSpend) },
              roas: { valor: comparative.previous.roas, display: fmtRatio(comparative.previous.roas) },
            }
          : null,
        deltas: comparative.deltas,
        dataQuality: comparative.current?.dataQuality || {},
      };
    },
    buildTitle: (storeName, from, to) => `Revisión semanal · ${storeName} · ${fmtDateRange(from, to)}`,
  },

  // --------------------------------------------------------------------------
  'monthly-close': {
    key: 'monthly-close',
    label: 'Cierre mensual',
    description: 'Cierre del mes con vista cohort + comparación vs target + roadmap del mes siguiente. Para reunión con cliente.',
    section: 'dashboard',
    frequency: 'monthly',
    audience: 'cliente',
    contextNeeded: ['dashboard', 'meta', 'clientes', 'costos'],
    contextRefs: [
      'GET /api/stores/:storeId/metrics?from=:from&to=:to',
      'GET /api/stores/:storeId/customers/segments',
      'GET /api/stores/:storeId/customers/cohorts',
      'MCP resource hooks://stores/:storeId/commercial-overview',
    ],
    systemPromptHint: 'Tono: dirigido al cliente final, profesional pero accesible. Sin jerga técnica. Marcá victorias, riesgos y plan. 600-900 palabras totales. Cerrá con un compromiso medible para el mes siguiente.',
    structure: [
      {
        id: 'resumen-cliente',
        title: 'Resumen del mes',
        type: 'narrative',
        guidance: 'Foto del mes en lenguaje de cliente final. 1 victoria clara, 1 desafío, 1 oportunidad. Sin jerga.',
        maxWords: 100,
      },
      {
        id: 'numeros',
        title: 'Números del mes',
        type: 'metrics-table',
        guidance: 'Facturación, ganancia, órdenes, ROAS, ticket promedio. Comparar vs mes anterior si hay data.',
        metricsToCite: ['revenue', 'profit', 'ordenes', 'aov', 'roas', 'profitMargin'],
      },
      {
        id: 'clientes',
        title: 'Base de clientes',
        type: 'narrative',
        guidance: 'Lectura de segmentos RFM. Champions cuántos, en riesgo cuántos, recompra %. Si los Champions cayeron, alertar.',
        maxWords: 120,
      },
      {
        id: 'cohortes',
        title: 'Retención por cohort',
        type: 'narrative',
        guidance: 'Mirá la cohort del mes que acaba: cuántos compraron, M0=100%. Comparar con cohorts anteriores: ¿la retención M1 está mejorando?',
        maxWords: 100,
      },
      {
        id: 'vs-target',
        title: 'Cumplimiento de objetivos',
        type: 'narrative',
        guidance: 'Si hay targets configurados (revenue, ROAS, CPA), comparar real vs target. Si no hay, mencionar que conviene definirlos para el próximo mes.',
        maxWords: 80,
      },
      {
        id: 'plan-mes',
        title: 'Plan del mes siguiente',
        type: 'action-list',
        guidance: 'De 4 a 6 acciones para el próximo mes. Cada una con outcome medible. Última debe ser un compromiso cuantitativo (ej: "subir ROAS de 2.5x a 2.8x").',
        minItems: 4,
        maxItems: 6,
      },
    ],
    buildMetricsBlock: async (storeId, from, to) => {
      const comparative = await buildComparativeBlock(storeId, from, to);
      const storeMeta = await Store.findById(storeId).select('nombre objetivos').lean();
      const sid = new mongoose.Types.ObjectId(storeId);
      const segments = await Customer.aggregate([
        { $match: { storeId: sid, rfmSegment: { $exists: true } } },
        { $group: { _id: '$rfmSegment', count: { $sum: 1 }, totalRevenue: { $sum: '$totalSpent' }, avgLTV: { $avg: '$ltv' } } },
        { $sort: { totalRevenue: -1 } },
      ]);
      return {
        store: { nombre: storeMeta?.nombre || 'Tienda' },
        periodo: comparative.current?.periodo,
        periodoAnterior: comparative.prevRange ? fmtDateRange(comparative.prevRange.from, comparative.prevRange.to) : null,
        current: comparative.current,
        previous: comparative.previous,
        deltas: comparative.deltas,
        targets: storeMeta?.objetivos?.kpis || null,
        segmentosRFM: segments,
        dataQuality: comparative.current?.dataQuality || {},
      };
    },
    buildTitle: (storeName, from, to) => `Cierre mensual · ${storeName} · ${fmtDateRange(from, to)}`,
  },

  // --------------------------------------------------------------------------
  'product-performance': {
    key: 'product-performance',
    label: 'Performance de productos',
    description: 'Top sellers, dead stock, reposición urgente, margen por categoría. Para decisiones de catálogo.',
    section: 'productos',
    frequency: 'on-demand',
    audience: 'operativo',
    contextNeeded: ['productos'],
    contextRefs: [
      'GET /api/stores/:storeId/products',
      'GET /api/stores/:storeId/products/commercial',
      'GET /api/stores/:storeId/products/overview',
    ],
    systemPromptHint: 'Foco accionable: qué reponer ya, qué liquidar, qué subir de precio. Listar productos por nombre y unidades reales.',
    structure: [
      {
        id: 'salud-catalogo',
        title: 'Salud del catálogo',
        type: 'metrics-table',
        guidance: 'Total productos, % activos, % con costo cargado, % con stock, % vendidos en el período.',
        metricsToCite: ['totalProducts', 'activeCount', 'productsWithCosts', 'stockoutCount', 'soldCount'],
      },
      {
        id: 'top-sellers',
        title: 'Top productos del período',
        type: 'product-list',
        guidance: 'Top 10 productos por revenue del período. Incluir unidades vendidas, revenue, margen estimado.',
        maxItems: 10,
      },
      {
        id: 'dead-stock',
        title: 'Stock parado',
        type: 'narrative-with-list',
        guidance: 'Productos con stock > 0 pero sin venta en el período. Top 5 por valor de stock atrapado. Acción: liquidar o promo.',
        maxItems: 5,
      },
      {
        id: 'reposicion',
        title: 'Reposición urgente',
        type: 'narrative-with-list',
        guidance: 'Productos vendiendo bien pero con stock < 7 días (basado en velocity). Top 5 por urgencia. Acción: comprar ya.',
        maxItems: 5,
      },
      {
        id: 'acciones',
        title: 'Acciones de catálogo',
        type: 'action-list',
        guidance: 'De 3 a 5 acciones priorizadas. Cada una: liquidar X, reponer Y, subir precio Z, etc.',
        minItems: 3,
        maxItems: 5,
      },
    ],
    buildMetricsBlock: async (storeId, from, to) => {
      const sid = new mongoose.Types.ObjectId(storeId);
      const storeMeta = await Store.findById(storeId).select('nombre').lean();
      const [total, active, withCost, stockout] = await Promise.all([
        Product.countDocuments({ storeId: sid }),
        Product.countDocuments({ storeId: sid, activo: true }),
        Product.countDocuments({ storeId: sid, costoUnitario: { $gt: 0 } }),
        Product.countDocuments({ storeId: sid, stock: 0 }),
      ]);
      const productSample = await Product.find({ storeId: sid })
        .select('nombre sku stock precio costoUnitario periodSales periodRevenue velocity diasDeStock activo')
        .sort({ periodRevenue: -1 })
        .limit(40)
        .lean();
      return {
        store: { nombre: storeMeta?.nombre || 'Tienda' },
        periodo: fmtDateRange(from, to),
        summary: {
          totalProducts: total,
          activeCount: active,
          productsWithCosts: withCost,
          costCoveragePct: total > 0 ? ((withCost / total) * 100).toFixed(1) : '0',
          stockoutCount: stockout,
        },
        sampleProducts: productSample,
        contextRef: 'Si necesitás más productos, consultá GET /api/stores/:storeId/products',
      };
    },
    buildTitle: (storeName, from, to) => `Performance de productos · ${storeName} · ${fmtDateRange(from, to)}`,
  },

  // --------------------------------------------------------------------------
  'customer-cohorts': {
    key: 'customer-cohorts',
    label: 'Cohortes y segmentos de clientes',
    description: 'RFM, retención por cohort, LTV, segmentos en movimiento. Para decisiones de retención.',
    section: 'clientes',
    frequency: 'monthly',
    audience: 'operativo',
    contextNeeded: ['clientes'],
    contextRefs: [
      'GET /api/stores/:storeId/customers/segments',
      'GET /api/stores/:storeId/customers/cohorts',
      'GET /api/stores/:storeId/customers?segment=at_risk',
    ],
    systemPromptHint: 'Foco en LIFETIME. Comparar cohorts: la cohort de este mes retiene mejor o peor que la anterior? Identificar segmento prioritario (At Risk con LTV alto = recuperación urgente).',
    structure: [
      {
        id: 'foto',
        title: 'Foto de la base de clientes',
        type: 'metrics-table',
        guidance: 'Total clientes, % nuevos, % repeaters, segmento dominante por revenue.',
        metricsToCite: ['totalClientes', 'segmentosRFM'],
      },
      {
        id: 'rfm',
        title: 'Distribución RFM',
        type: 'narrative',
        guidance: 'Resumen de segmentos: Champions cuántos y qué revenue, At Risk cuántos y qué revenue en juego, hibernating tamaño.',
        maxWords: 150,
      },
      {
        id: 'cohorts',
        title: 'Tendencia de retención',
        type: 'narrative',
        guidance: 'Mirá las cohorts de los últimos 6 meses. ¿M1 está mejorando o empeorando? Si retención M1 < 10%, hay problema de producto/oferta.',
        maxWords: 140,
      },
      {
        id: 'segmento-prioritario',
        title: 'Segmento prioritario',
        type: 'narrative',
        guidance: 'Identificar el segmento con mayor leverage. Usualmente: At Risk (alto LTV histórico, recencia mala) = recuperación urgente. Especificar cuántos clientes y revenue en juego.',
        maxWords: 100,
      },
      {
        id: 'plan-retencion',
        title: 'Plan de retención',
        type: 'action-list',
        guidance: 'De 3 a 5 acciones de retención específicas. Cada una con: a qué segmento apunta, canal sugerido (email/WhatsApp), oferta/mensaje, métrica de éxito.',
        minItems: 3,
        maxItems: 5,
      },
    ],
    buildMetricsBlock: async (storeId, from, to) => {
      const sid = new mongoose.Types.ObjectId(storeId);
      const storeMeta = await Store.findById(storeId).select('nombre').lean();
      const [segments, total, repeaters] = await Promise.all([
        Customer.aggregate([
          { $match: { storeId: sid, rfmSegment: { $exists: true } } },
          {
            $group: {
              _id: '$rfmSegment',
              count: { $sum: 1 },
              totalRevenue: { $sum: '$totalSpent' },
              avgLTV: { $avg: '$ltv' },
              avgRecency: { $avg: '$recency' },
            },
          },
          { $sort: { totalRevenue: -1 } },
        ]),
        Customer.countDocuments({ storeId: sid }),
        Customer.countDocuments({ storeId: sid, totalOrders: { $gt: 1 } }),
      ]);
      return {
        store: { nombre: storeMeta?.nombre || 'Tienda' },
        periodo: fmtDateRange(from, to),
        summary: {
          totalClientes: total,
          repeaters,
          repurchaseRate: total > 0 ? ((repeaters / total) * 100).toFixed(1) + '%' : '0%',
        },
        segmentosRFM: segments,
        contextRef: 'Para cohortes detalladas: GET /api/stores/:storeId/customers/cohorts',
      };
    },
    buildTitle: (storeName, from, to) => `Cohortes y segmentos · ${storeName} · ${fmtDateRange(from, to)}`,
  },
};

// ============================================================================
// API pública
// ============================================================================

function listTemplates() {
  return Object.values(TEMPLATES).map((t) => ({
    key: t.key,
    label: t.label,
    description: t.description,
    section: t.section,
    frequency: t.frequency,
    audience: t.audience,
    sectionCount: t.structure.length,
  }));
}

function getTemplate(key) {
  return TEMPLATES[key] || null;
}

async function buildBriefing(templateKey, storeId, from, to) {
  const tmpl = TEMPLATES[templateKey];
  if (!tmpl) {
    const err = new Error(`Template "${templateKey}" no existe. Templates disponibles: ${Object.keys(TEMPLATES).join(', ')}`);
    err.status = 404;
    throw err;
  }

  const storeMeta = await Store.findById(storeId).select('nombre plataforma storeUrl').lean();
  if (!storeMeta) {
    const err = new Error('Tienda no encontrada');
    err.status = 404;
    throw err;
  }

  const metricsBlock = await tmpl.buildMetricsBlock(storeId, from, to);

  return {
    template: {
      key: tmpl.key,
      label: tmpl.label,
      description: tmpl.description,
      audience: tmpl.audience,
    },
    storeId,
    store: {
      nombre: storeMeta.nombre,
      plataforma: storeMeta.plataforma,
      url: storeMeta.storeUrl,
    },
    dateRange: { from: from || null, to: to || null },
    suggestedTitle: tmpl.buildTitle(storeMeta.nombre, from, to),
    suggestedSection: tmpl.section,
    systemPromptHint: tmpl.systemPromptHint,
    structure: tmpl.structure,
    metricsBlock,
    contextRefs: tmpl.contextRefs,
    instructions: [
      `1. Leé el metricsBlock — son tus datos duros, NO los recalculés.`,
      `2. Completá cada sección de structure[] respetando type y guidance.`,
      `3. Cumplí el checklist de cada sección si lo trae.`,
      `4. Si te falta data para una sección, marcala como "datos insuficientes" — no inventés.`,
      `5. Cuando termines, subí el reporte con MCP tool create_report o POST /api/stores/:storeId/reports con campos: titulo, contenido (markdown), summary, section, tipo='report'.`,
    ],
  };
}

module.exports = {
  listTemplates,
  getTemplate,
  buildBriefing,
  // Para uso desde el MCP server u otros services
  TEMPLATES,
};
