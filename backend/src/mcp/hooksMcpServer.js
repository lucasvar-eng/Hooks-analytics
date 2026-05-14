const path = require('path');
const connectDB = require('../config/database');
const { mcp } = require('../config/environment');
const Store = require('../models/Store');
const Report = require('../models/Report');
const TeamNote = require('../models/TeamNote');
const User = require('../models/User');
const { aggregateRange } = require('../services/metricCalculator');
const { getSyncStatus } = require('../services/tiendaService');
const { getCreativePipeline, getFrameworkOverview } = require('../services/creativeService');
const { getCommercialOverview } = require('../services/productService');
const { getFinancialConsistency } = require('../services/financeService');
const { buildContext } = require('../services/aiService');
const reportTemplates = require('../services/reportTemplateService');
const logger = require('../utils/logger');

const SERVER_INFO = {
  name: 'hooks-analytics',
  version: '0.1.0',
};

const PROTOCOL_VERSION = '2024-11-05';
const ROOT_DIR = path.resolve(__dirname, '../../..');

const ready = connectDB();

function sendMessage(message) {
  const json = JSON.stringify(message);
  const bytes = Buffer.byteLength(json, 'utf8');
  process.stdout.write(`Content-Length: ${bytes}\r\n\r\n${json}`);
}

function sendResponse(id, result) {
  sendMessage({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message, data) {
  sendMessage({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data,
    },
  });
}

function makeTextContent(text) {
  return [{ type: 'text', text }];
}

function makeJsonResource(uri, data) {
  return {
    uri,
    mimeType: 'application/json',
    text: JSON.stringify(data, null, 2),
  };
}

function parseDateRange(args = {}) {
  const to = args.to || new Date().toISOString().slice(0, 10);
  const from = args.from || new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { from, to };
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

async function listStoresBasic() {
  const stores = await Store.find({})
    .select('nombre plataforma tnStoreId metaAdAccountId metaAdAccounts integrationStatus logoUrl storeUrl')
    .sort({ nombre: 1 })
    .lean();

  return stores.map((store) => ({
    id: String(store._id),
    nombre: store.nombre,
    plataforma: store.plataforma,
    tnStoreId: store.tnStoreId || null,
    metaAdAccountId: store.metaAdAccountId || null,
    metaAdAccountIds: Array.isArray(store.metaAdAccounts) ? store.metaAdAccounts.map((item) => item.id).filter(Boolean) : [],
    storeUrl: store.storeUrl || null,
    logoUrl: store.logoUrl || null,
    integrationStatus: store.integrationStatus || {},
  }));
}

async function resolveAuthorUser() {
  const preferredEmail = String(mcp.defaultAuthorEmail || '').trim().toLowerCase();
  let user = null;

  if (preferredEmail) {
    user = await User.findOne({ email: preferredEmail, isActive: true }).select('_id email nombre role').lean();
  }

  if (!user) {
    user = await User.findOne({ role: 'admin', isActive: true }).sort({ createdAt: 1 }).select('_id email nombre role').lean();
  }

  if (!user) {
    throw new Error('No hay usuario autor disponible para operaciones MCP con escritura');
  }

  return user;
}

async function resolveStoreIdentifier(identifier) {
  const raw = String(identifier || '').trim();
  if (!raw) {
    throw new Error('store es requerido');
  }

  let store = null;
  if (/^[a-f0-9]{24}$/i.test(raw)) {
    store = await Store.findById(raw).lean();
  }

  if (!store) {
    const normalized = normalizeName(raw);
    store = await Store.findOne({
      $or: [
        { nombre: new RegExp(`^${raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        { tnNombre: new RegExp(`^${raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        { tnStoreId: raw },
      ],
    }).lean();

    if (!store) {
      const stores = await Store.find({}).select('nombre tnNombre tnStoreId').lean();
      store = stores.find((item) =>
        [item.nombre, item.tnNombre, item.tnStoreId]
          .filter(Boolean)
          .some((candidate) => normalizeName(candidate).includes(normalized))
      );
    }
  }

  if (!store) {
    throw new Error(`No encontré una tienda para "${raw}"`);
  }

  return store;
}

async function getStoreOverviewPayload(storeRef, args = {}) {
  const store = await resolveStoreIdentifier(storeRef);
  const { from, to } = parseDateRange(args);
  const metrics = await aggregateRange(store._id, from, to);
  return {
    store: {
      id: String(store._id),
      nombre: store.nombre,
      plataforma: store.plataforma,
      tnStoreId: store.tnStoreId || null,
      metaAdAccountId: store.metaAdAccountId || null,
      metaAdAccountIds: Array.isArray(store.metaAdAccounts) ? store.metaAdAccounts.map((item) => item.id).filter(Boolean) : [],
    },
    range: { from, to },
    metrics,
  };
}

async function getSyncStatusPayload(storeRef, args = {}) {
  const store = await resolveStoreIdentifier(storeRef);
  const { from, to } = parseDateRange(args);
  return getSyncStatus(store._id, from, to);
}

async function getCreativePipelinePayload(storeRef, args = {}) {
  const store = await resolveStoreIdentifier(storeRef);
  const { from, to } = parseDateRange(args);
  const [pipeline, framework] = await Promise.all([
    getCreativePipeline(store._id, from, to),
    getFrameworkOverview(store._id),
  ]);
  return {
    store: { id: String(store._id), nombre: store.nombre },
    range: { from, to },
    pipeline,
    framework,
  };
}

async function getCommercialPayload(storeRef, args = {}) {
  const store = await resolveStoreIdentifier(storeRef);
  const { from, to } = parseDateRange(args);
  const commercial = await getCommercialOverview(store._id, from, to);
  return {
    store: { id: String(store._id), nombre: store.nombre },
    range: { from, to },
    commercial,
  };
}

async function getAiContextPayload(storeRef, args = {}) {
  const store = await resolveStoreIdentifier(storeRef);
  const { from, to } = parseDateRange(args);
  const section = args.section || 'dashboard';
  const context = await buildContext(section, store._id, from, to);
  return {
    store: { id: String(store._id), nombre: store.nombre },
    section,
    range: { from, to },
    context,
  };
}

async function getReportsPayload(storeRef, args = {}) {
  const store = await resolveStoreIdentifier(storeRef);
  const limit = Math.max(1, Math.min(Number(args.limit || 10), 50));
  const reports = await Report.find({ storeId: store._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('titulo section tipo summary createdAt provider model confidence generationMode qualityNote dateRange')
    .lean();

  return {
    store: { id: String(store._id), nombre: store.nombre },
    reports,
  };
}

async function getFinancialConsistencyPayload(storeRef, args = {}) {
  const store = await resolveStoreIdentifier(storeRef);
  const { from, to } = parseDateRange(args);
  const consistency = await getFinancialConsistency(store._id, from, to);
  return {
    store: { id: String(store._id), nombre: store.nombre },
    range: { from, to },
    consistency,
  };
}

async function createReportPayload(args = {}) {
  const store = await resolveStoreIdentifier(args.store);
  const author = await resolveAuthorUser();
  const { from, to } = parseDateRange(args);
  const tipo = args.tipo || 'report';
  const report = await Report.create({
    storeId: store._id,
    tipo,
    titulo: String(args.titulo || '').trim(),
    contenido: String(args.contenido || '').trim(),
    section: args.section || 'general',
    summary: args.summary || '',
    dateRange: args.includeDateRange === false ? undefined : { from: new Date(from), to: new Date(to) },
    snapshot: args.snapshot || null,
    tokensUsed: Number(args.tokensUsed || 0),
    model: args.model || 'claude-mcp',
    provider: args.provider || 'anthropic_mcp',
    confidence: args.confidence == null ? null : Number(args.confidence),
    qualityNote: args.qualityNote || 'Creado desde Claude por MCP.',
    generationMode: args.generationMode || 'manual',
  });

  return {
    ok: true,
    createdBy: {
      id: String(author._id),
      email: author.email,
      nombre: author.nombre,
    },
    report: {
      id: String(report._id),
      titulo: report.titulo,
      tipo: report.tipo,
      section: report.section,
      createdAt: report.createdAt,
    },
  };
}

async function createTeamNotePayload(args = {}) {
  const store = await resolveStoreIdentifier(args.store);
  const author = await resolveAuthorUser();
  const text = String(args.text || '').trim();
  if (!text) {
    throw new Error('text es requerido');
  }

  const note = await TeamNote.create({
    storeId: store._id,
    section: args.section || 'general',
    text,
    author: author._id,
  });

  return {
    ok: true,
    createdBy: {
      id: String(author._id),
      email: author.email,
      nombre: author.nombre,
    },
    note: {
      id: String(note._id),
      section: note.section,
      text: note.text,
      createdAt: note.createdAt,
    },
  };
}

const TOOLS = [
  {
    name: 'list_stores',
    description: 'Lista las tiendas disponibles con sus IDs e integraciones conectadas.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => ({ stores: await listStoresBasic() }),
  },
  {
    name: 'get_store_overview',
    description: 'Devuelve overview de métricas agregadas para una tienda y rango.',
    inputSchema: {
      type: 'object',
      properties: {
        store: { type: 'string', description: 'ID o nombre de la tienda' },
        from: { type: 'string', description: 'YYYY-MM-DD' },
        to: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['store'],
      additionalProperties: false,
    },
    handler: async (args) => getStoreOverviewPayload(args.store, args),
  },
  {
    name: 'get_sync_status',
    description: 'Muestra estado de sync, fuentes y reconciliación de una tienda.',
    inputSchema: {
      type: 'object',
      properties: {
        store: { type: 'string', description: 'ID o nombre de la tienda' },
        from: { type: 'string', description: 'YYYY-MM-DD' },
        to: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['store'],
      additionalProperties: false,
    },
    handler: async (args) => getSyncStatusPayload(args.store, args),
  },
  {
    name: 'get_ai_context_snapshot',
    description: 'Devuelve el contexto estructurado que Hooks usa para AI en una sección.',
    inputSchema: {
      type: 'object',
      properties: {
        store: { type: 'string', description: 'ID o nombre de la tienda' },
        section: { type: 'string', description: 'dashboard|meta|productos|clientes|creativos|competencia|costos|cashflow|report' },
        from: { type: 'string', description: 'YYYY-MM-DD' },
        to: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['store', 'section'],
      additionalProperties: false,
    },
    handler: async (args) => getAiContextPayload(args.store, args),
  },
  {
    name: 'get_creative_pipeline',
    description: 'Devuelve el pipeline creativo, backlog y framework resumido.',
    inputSchema: {
      type: 'object',
      properties: {
        store: { type: 'string', description: 'ID o nombre de la tienda' },
        from: { type: 'string', description: 'YYYY-MM-DD' },
        to: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['store'],
      additionalProperties: false,
    },
    handler: async (args) => getCreativePipelinePayload(args.store, args),
  },
  {
    name: 'get_commercial_overview',
    description: 'Devuelve overview comercial del catálogo, surtido y stock.',
    inputSchema: {
      type: 'object',
      properties: {
        store: { type: 'string', description: 'ID o nombre de la tienda' },
        from: { type: 'string', description: 'YYYY-MM-DD' },
        to: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['store'],
      additionalProperties: false,
    },
    handler: async (args) => getCommercialPayload(args.store, args),
  },
  {
    name: 'get_reports',
    description: 'Lista reportes recientes de una tienda.',
    inputSchema: {
      type: 'object',
      properties: {
        store: { type: 'string', description: 'ID o nombre de la tienda' },
        limit: { type: 'number', description: 'Máximo 50 reportes' },
      },
      required: ['store'],
      additionalProperties: false,
    },
    handler: async (args) => getReportsPayload(args.store, args),
  },
  {
    name: 'get_financial_consistency',
    description: 'Devuelve la consistencia financiera de una tienda para un rango.',
    inputSchema: {
      type: 'object',
      properties: {
        store: { type: 'string', description: 'ID o nombre de la tienda' },
        from: { type: 'string', description: 'YYYY-MM-DD' },
        to: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['store'],
      additionalProperties: false,
    },
    handler: async (args) => getFinancialConsistencyPayload(args.store, args),
  },
  {
    name: 'create_report',
    description: 'Crea un reporte en Hooks para una tienda. Uso recomendado: resultados finales o resúmenes ejecutivos.',
    inputSchema: {
      type: 'object',
      properties: {
        store: { type: 'string', description: 'ID o nombre de la tienda' },
        titulo: { type: 'string', description: 'Título del reporte' },
        contenido: { type: 'string', description: 'Contenido markdown del reporte' },
        summary: { type: 'string', description: 'Resumen corto del reporte' },
        section: { type: 'string', description: 'Sección asociada, por ejemplo dashboard o creativos' },
        tipo: { type: 'string', description: 'analysis|report|diagnostic' },
        from: { type: 'string', description: 'YYYY-MM-DD' },
        to: { type: 'string', description: 'YYYY-MM-DD' },
        confidence: { type: 'number', description: 'Confianza entre 0 y 1' },
        qualityNote: { type: 'string', description: 'Nota de calidad del dato o del análisis' },
      },
      required: ['store', 'titulo', 'contenido'],
      additionalProperties: true,
    },
    handler: async (args) => createReportPayload(args),
  },
  {
    name: 'save_analysis',
    description: 'Guarda un análisis en Hooks como tipo analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        store: { type: 'string', description: 'ID o nombre de la tienda' },
        titulo: { type: 'string', description: 'Título del análisis' },
        contenido: { type: 'string', description: 'Contenido markdown' },
        summary: { type: 'string', description: 'Resumen corto' },
        section: { type: 'string', description: 'Sección asociada' },
        from: { type: 'string', description: 'YYYY-MM-DD' },
        to: { type: 'string', description: 'YYYY-MM-DD' },
        confidence: { type: 'number', description: 'Confianza entre 0 y 1' },
        qualityNote: { type: 'string', description: 'Nota de calidad' },
      },
      required: ['store', 'titulo', 'contenido'],
      additionalProperties: true,
    },
    handler: async (args) => createReportPayload({ ...args, tipo: 'analysis' }),
  },
  {
    name: 'list_report_templates',
    description: 'Lista los templates de reporte disponibles (executive, weekly-review, monthly-close, product-performance, customer-cohorts). Cada template es un briefing estructurado: secciones obligatorias, métricas pre-calculadas, system prompt sugerido. Usar antes de get_report_briefing.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => ({ templates: reportTemplates.listTemplates() }),
  },
  {
    name: 'get_report_briefing',
    description: 'Devuelve el briefing completo de un template para una tienda y período: estructura del reporte + métricas reales pre-calculadas + system prompt sugerido. Completá las secciones y subí el resultado con create_report.',
    inputSchema: {
      type: 'object',
      properties: {
        template_key: { type: 'string', description: 'executive | weekly-review | monthly-close | product-performance | customer-cohorts' },
        store: { type: 'string', description: 'ID o nombre de la tienda' },
        from: { type: 'string', description: 'YYYY-MM-DD' },
        to: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['template_key', 'store'],
      additionalProperties: false,
    },
    handler: async (args) => {
      const store = await resolveStoreIdentifier(args.store);
      if (!store) throw new Error(`Tienda no encontrada: ${args.store}`);
      const briefing = await reportTemplates.buildBriefing(args.template_key, store._id, args.from, args.to);
      return briefing;
    },
  },
  {
    name: 'create_team_note',
    description: 'Crea una nota interna del equipo en Hooks para una tienda.',
    inputSchema: {
      type: 'object',
      properties: {
        store: { type: 'string', description: 'ID o nombre de la tienda' },
        section: { type: 'string', description: 'general, dashboard, creativos, etc' },
        text: { type: 'string', description: 'Texto de la nota' },
      },
      required: ['store', 'text'],
      additionalProperties: false,
    },
    handler: async (args) => createTeamNotePayload(args),
  },
];

const PROMPTS = [
  {
    name: 'analizar_negocio',
    description: 'Analiza una tienda con foco ejecutivo, salud del dato y acciones.',
    arguments: [
      { name: 'store', required: true, description: 'ID o nombre de la tienda' },
      { name: 'from', required: false, description: 'YYYY-MM-DD' },
      { name: 'to', required: false, description: 'YYYY-MM-DD' },
    ],
  },
  {
    name: 'auditar_sync',
    description: 'Audita integridad, fuentes y reconciliación de una tienda.',
    arguments: [
      { name: 'store', required: true, description: 'ID o nombre de la tienda' },
      { name: 'from', required: false, description: 'YYYY-MM-DD' },
      { name: 'to', required: false, description: 'YYYY-MM-DD' },
    ],
  },
  {
    name: 'revisar_pipeline_creativo',
    description: 'Revisa el pipeline creativo y arma plan de próximos tests.',
    arguments: [
      { name: 'store', required: true, description: 'ID o nombre de la tienda' },
      { name: 'from', required: false, description: 'YYYY-MM-DD' },
      { name: 'to', required: false, description: 'YYYY-MM-DD' },
    ],
  },
];

async function handleToolCall(name, args) {
  const tool = TOOLS.find((item) => item.name === name);
  if (!tool) {
    return {
      isError: true,
      content: makeTextContent(`Tool desconocido: ${name}`),
    };
  }

  try {
    const result = await tool.handler(args || {});
    return {
      content: makeTextContent(JSON.stringify(result, null, 2)),
    };
  } catch (error) {
    return {
      isError: true,
      content: makeTextContent(error.message || 'Error ejecutando tool'),
    };
  }
}

async function handlePromptGet(name, args = {}) {
  const { from, to } = parseDateRange(args);
  const store = args.store || '<store>';
  if (name === 'analizar_negocio') {
    return {
      description: 'Prompt para análisis ejecutivo con datos reales de Hooks.',
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Analizá la tienda "${store}" del ${from} al ${to}. Primero llamá a get_store_overview, get_sync_status y get_financial_consistency. Si necesitás más detalle, usá get_ai_context_snapshot con section dashboard. Cerrá con 3 acciones priorizadas y explicitá el nivel de confianza del dato.`,
        },
      }],
    };
  }
  if (name === 'auditar_sync') {
    return {
      description: 'Prompt para auditoría de sync y reconciliación.',
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Auditá la integridad de la tienda "${store}" del ${from} al ${to}. Usá get_sync_status y, si hace falta, get_store_overview. Marcá mismatches, estado de fuentes y qué dato todavía no tomarías como definitivo.`,
        },
      }],
    };
  }
  if (name === 'revisar_pipeline_creativo') {
    return {
      description: 'Prompt para revisar pipeline creativo y backlog.',
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Revisá el pipeline creativo de "${store}" del ${from} al ${to}. Usá get_creative_pipeline y get_ai_context_snapshot con section creativos. Decime qué escalar, qué pausar y qué testear después, sin inventar conclusiones si la confianza del dato es media o baja.`,
        },
      }],
    };
  }
  throw new Error(`Prompt desconocido: ${name}`);
}

async function handleResourceRead(uri) {
  const parsed = new URL(uri);
  if (parsed.protocol !== 'hooks:') {
    throw new Error(`URI no soportada: ${uri}`);
  }

  if (parsed.hostname === 'stores' && (!parsed.pathname || parsed.pathname === '/')) {
    return {
      contents: [makeJsonResource(uri, { stores: await listStoresBasic() })],
    };
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (parsed.hostname === 'stores' && segments.length >= 2) {
    const [storeId, resourceName] = segments;
    const args = {
      from: parsed.searchParams.get('from') || undefined,
      to: parsed.searchParams.get('to') || undefined,
      section: parsed.searchParams.get('section') || undefined,
    };

    let data;
    if (resourceName === 'overview') data = await getStoreOverviewPayload(storeId, args);
    else if (resourceName === 'sync-status') data = await getSyncStatusPayload(storeId, args);
    else if (resourceName === 'creative-pipeline') data = await getCreativePipelinePayload(storeId, args);
    else if (resourceName === 'commercial') data = await getCommercialPayload(storeId, args);
    else if (resourceName === 'financial-consistency') data = await getFinancialConsistencyPayload(storeId, args);
    else if (resourceName === 'ai-context') data = await getAiContextPayload(storeId, args);
    else if (resourceName === 'reports') data = await getReportsPayload(storeId, { limit: Number(parsed.searchParams.get('limit') || 10) });
    else throw new Error(`Recurso no soportado: ${resourceName}`);

    return { contents: [makeJsonResource(uri, data)] };
  }

  throw new Error(`URI no soportada: ${uri}`);
}

function listResources() {
  return {
    resources: [
      {
        uri: 'hooks://stores',
        name: 'Tiendas disponibles',
        description: 'Lista de tiendas configuradas en Hooks Analytics.',
        mimeType: 'application/json',
      },
    ],
  };
}

function listResourceTemplates() {
  return {
    resourceTemplates: [
      {
        uriTemplate: 'hooks://stores/{storeId}/overview?from={from}&to={to}',
        name: 'Overview de tienda',
        description: 'Métricas agregadas por tienda y rango.',
        mimeType: 'application/json',
      },
      {
        uriTemplate: 'hooks://stores/{storeId}/sync-status?from={from}&to={to}',
        name: 'Sync y reconciliación',
        description: 'Estado de fuentes y reconciliación por tienda.',
        mimeType: 'application/json',
      },
      {
        uriTemplate: 'hooks://stores/{storeId}/creative-pipeline?from={from}&to={to}',
        name: 'Pipeline creativo',
        description: 'Pipeline creativo y backlog estratégico.',
        mimeType: 'application/json',
      },
      {
        uriTemplate: 'hooks://stores/{storeId}/commercial?from={from}&to={to}',
        name: 'Overview comercial',
        description: 'Resumen comercial del catálogo y stock.',
        mimeType: 'application/json',
      },
      {
        uriTemplate: 'hooks://stores/{storeId}/financial-consistency?from={from}&to={to}',
        name: 'Consistencia financiera',
        description: 'Chequeo financiero y diferencias del rango.',
        mimeType: 'application/json',
      },
      {
        uriTemplate: 'hooks://stores/{storeId}/ai-context?section={section}&from={from}&to={to}',
        name: 'Contexto AI',
        description: 'Contexto estructurado usado por Hooks para AI.',
        mimeType: 'application/json',
      },
      {
        uriTemplate: 'hooks://stores/{storeId}/reports?limit={limit}',
        name: 'Reportes recientes',
        description: 'Lista de reportes recientes por tienda.',
        mimeType: 'application/json',
      },
    ],
  };
}

async function handleRequest(request) {
  await ready;

  switch (request.method) {
    case 'initialize':
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        serverInfo: SERVER_INFO,
      };
    case 'ping':
      return {};
    case 'tools/list':
      return {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      };
    case 'tools/call':
      return handleToolCall(request.params?.name, request.params?.arguments);
    case 'resources/list':
      return listResources();
    case 'resources/templates/list':
      return listResourceTemplates();
    case 'resources/read':
      return handleResourceRead(request.params?.uri);
    case 'prompts/list':
      return { prompts: PROMPTS };
    case 'prompts/get':
      return handlePromptGet(request.params?.name, request.params?.arguments);
    case 'notifications/initialized':
      return null;
    default:
      throw new Error(`Método no soportado: ${request.method}`);
  }
}

let buffer = Buffer.alloc(0);

function processBuffer() {
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return;

    const headerText = buffer.slice(0, headerEnd).toString('utf8');
    const headers = headerText.split('\r\n');
    const contentLengthHeader = headers.find((line) => line.toLowerCase().startsWith('content-length:'));
    if (!contentLengthHeader) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }

    const contentLength = Number(contentLengthHeader.split(':')[1].trim());
    const messageStart = headerEnd + 4;
    const messageEnd = messageStart + contentLength;
    if (buffer.length < messageEnd) return;

    const raw = buffer.slice(messageStart, messageEnd).toString('utf8');
    buffer = buffer.slice(messageEnd);

    let request;
    try {
      request = JSON.parse(raw);
    } catch (error) {
      logger.error('MCP JSON inválido', error.message);
      continue;
    }

    Promise.resolve(handleRequest(request))
      .then((result) => {
        if (request.id == null || result == null) return;
        sendResponse(request.id, result);
      })
      .catch((error) => {
        if (request.id == null) return;
        sendError(request.id, -32000, error.message || 'Unhandled MCP error');
      });
  }
}

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  processBuffer();
});

process.stdin.on('end', async () => {
  try {
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  } catch {}
  process.exit(0);
});

process.on('SIGINT', () => process.stdin.emit('end'));
process.on('SIGTERM', () => process.stdin.emit('end'));

logger.info(`Hooks MCP server ready (${ROOT_DIR})`);
