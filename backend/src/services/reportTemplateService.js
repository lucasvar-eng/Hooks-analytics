const Store = require('../models/Store');
const { buildContext } = require('./aiService');
const { getCreativePipeline, getFrameworkOverview } = require('./creativeService');

function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return '$0';
  return `$${Math.round(Number(value)).toLocaleString('es-AR')}`;
}

function formatRatio(value) {
  if (value == null || value === 'Sin datos') return 'Sin datos';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `${num.toFixed(2)}x`;
}

function formatPct(value) {
  if (value == null) return '0%';
  if (typeof value === 'string') return value;
  return `${Number(value).toFixed(1)}%`;
}

function toDateLabel(from, to) {
  return `${from || 'inicio'} a ${to || 'hoy'}`;
}

function summarizeStoreHealth(context) {
  const warnings = [];
  if ((context?.dataQuality?.confidence ?? 1) < 0.8) warnings.push('confianza media o baja del dato');
  if ((context?.ncOrdenes || 0) === (context?.ordenes || 0) && (context?.ordenes || 0) > 0) warnings.push('todo el volumen viene de nuevos clientes');
  if ((context?.adSpend || 0) === 0) warnings.push('sin inversión publicitaria registrada');
  if ((context?.devoluciones || 0) > 0) warnings.push('devoluciones registradas en el período');
  return warnings;
}

async function buildExecutiveReport(storeId, from, to, userId) {
  const [store, context] = await Promise.all([
    Store.findById(storeId).select('nombre').lean(),
    buildContext('dashboard', storeId, from, to),
  ]);
  const warnings = summarizeStoreHealth(context);

  const contenido = [
    `## Resumen ejecutivo`,
    `En el período **${toDateLabel(from, to)}**, **${store?.nombre || 'Tienda'}** registró **${context.ordenesPositivas || 0} órdenes positivas**, **${formatMoney(context.revenue)}** de facturación, **${formatMoney(context.netRevenue)}** de ingresos netos y **${formatMoney(context.adjustedProfit ?? context.profit)}** de ganancia ajustada.`,
    '',
    `## Foto del negocio`,
    `- **Facturación:** ${formatMoney(context.revenue)}`,
    `- **Ingresos netos:** ${formatMoney(context.netRevenue)}`,
    `- **Ganancia ajustada:** ${formatMoney(context.adjustedProfit ?? context.profit)}`,
    `- **Margen ajustado:** ${context.adjustedProfitMargin || context.profitMargin || '0%'}`,
    `- **Ad spend:** ${formatMoney(context.adSpend)}`,
    `- **True ROAS:** ${formatRatio(context.trueRoas)}`,
    `- **AOV:** ${formatMoney(context.aov)}`,
    `- **NC %:** ${context.ncPct || '0%'}`,
    '',
    `## Qué pasó y por qué importa`,
    `- El negocio cerró el período con una lectura financiera usable y con fuente principal basada en **${context.sourceCoverage?.orders || 'orders'}**.`,
    `- La cobertura de medios quedó en **${context.sourceCoverage?.ads || 'unknown'}**, con una confianza global del dato de **${Math.round((context.dataQuality?.confidence ?? 0.5) * 100)}%**.`,
    ...(warnings.length
      ? warnings.map((item) => `- Atención: ${item}.`)
      : ['- No aparecen alertas estructurales fuertes en este corte.']),
    '',
    `## Recomendación ejecutiva`,
    `- Confirmar primero si el freno principal hoy está en adquisición, conversión o recompra antes de tocar presupuesto.`,
    `- Revisar la mezcla NC/RC junto con el AOV para decidir si conviene priorizar volumen, ticket o eficiencia.`,
    `- Usar este reporte como portada y bajar a Meta, Tienda o Clientes solo después de validar esta foto general.`,
    '',
    `## Próximos pasos sugeridos`,
    `1. Validar si el nivel de ganancia actual es sostenible con el ad spend de este período.`,
    `2. Revisar la concentración del resultado en nuevos clientes vs recurrentes.`,
    `3. Bajar a la lectura de Meta y Creativos para identificar qué palanca mover primero.`,
  ].join('\n');

  return {
    titulo: `Reporte ejecutivo · ${store?.nombre || 'Tienda'} · ${toDateLabel(from, to)}`,
    section: 'dashboard',
    tipo: 'report',
    summary: `Facturación ${formatMoney(context.revenue)} · Ganancia ${formatMoney(context.adjustedProfit ?? context.profit)} · True ROAS ${formatRatio(context.trueRoas)}`,
    contenido,
    confidence: context.dataQuality?.confidence ?? 0.5,
    qualityNote: context.dataQuality?.note || '',
    generationMode: 'manual',
    snapshot: {
      metrics: context,
      sourceCoverage: context.sourceCoverage || {},
    },
  };
}

async function buildMetaPerformanceReport(storeId, from, to, userId) {
  const [store, context] = await Promise.all([
    Store.findById(storeId).select('nombre').lean(),
    buildContext('meta', storeId, from, to),
  ]);

  const topCampaigns = (context.campañas || []).slice(0, 5);

  const contenido = [
    `## Resumen Meta`,
    `Durante **${toDateLabel(from, to)}**, **${store?.nombre || 'Tienda'}** invirtió **${formatMoney(context.adSpend)}**, generó **${context.metaPurchases || 0} compras atribuidas**, un **ROAS de ${formatRatio(context.roas)}** y un **valor de conversión estimado de ${formatMoney(context.purchaseValue)}**.`,
    '',
    `## KPI de adquisición`,
    `- **Importe gastado:** ${formatMoney(context.adSpend)}`,
    `- **Compras Meta:** ${context.metaPurchases || 0}`,
    `- **CPA:** ${typeof context.cpa === 'number' ? formatMoney(context.cpa) : context.cpa || 'Sin datos'}`,
    `- **ROAS:** ${formatRatio(context.roas)}`,
    `- **True ROAS:** ${formatRatio(context.trueRoas)}`,
    `- **Impresiones:** ${(context.impressions || 0).toLocaleString('es-AR')}`,
    `- **Clicks:** ${(context.clicks || 0).toLocaleString('es-AR')}`,
    `- **LPV:** ${(context.landingPageViews || 0).toLocaleString('es-AR')}`,
    '',
    `## Campañas destacadas`,
    ...(topCampaigns.length
      ? topCampaigns.map((item) => `- **${item.nombre}**: spend ${formatMoney(item.spend)}, compras ${item.purchases || 0}, ROAS ${item.roas}.`)
      : ['- No hay campañas con spend suficiente en el período.']),
    '',
    `## Lectura y cautelas`,
    `- La cobertura de Ads quedó en **${context.sourceCoverage?.ads || 'unknown'}**.`,
    `- La confianza del dato para esta lectura es **${Math.round((context.dataQuality?.confidence ?? 0.5) * 100)}%**.`,
    context.dataQuality?.note ? `- Nota técnica: ${context.dataQuality.note}` : null,
    '',
    `## Recomendación ejecutiva`,
    `- Tomar decisiones solo sobre campañas con spend real y volumen suficiente.`,
    `- Cruza este reporte con el resultado comercial del negocio antes de escalar presupuesto.`,
    `- Si el rendimiento no acompaña, bajar después a Creativos para separar problema de media buying vs mensaje.`,
    '',
    `## Próximos pasos sugeridos`,
    `1. Identificar si el crecimiento vino por más gasto, mejor CPA o mejor ticket.`,
    `2. Separar campañas ganadoras, sostenibles y campañas que solo consumen presupuesto.`,
    `3. Revisar creativos y mensajes de las campañas con más inversión.`,
  ].filter(Boolean).join('\n');

  return {
    titulo: `Reporte Meta performance · ${store?.nombre || 'Tienda'} · ${toDateLabel(from, to)}`,
    section: 'meta',
    tipo: 'report',
    summary: `Spend ${formatMoney(context.adSpend)} · Compras ${context.metaPurchases || 0} · ROAS ${formatRatio(context.roas)}`,
    contenido,
    confidence: context.dataQuality?.confidence ?? 0.5,
    qualityNote: context.dataQuality?.note || '',
    generationMode: 'manual',
    snapshot: {
      metrics: context,
      sourceCoverage: context.sourceCoverage || {},
    },
  };
}

async function buildCreativeFrameworkReport(storeId, from, to, userId) {
  const [store, creativeContext, pipeline, framework] = await Promise.all([
    Store.findById(storeId).select('nombre').lean(),
    buildContext('creativos', storeId, from, to),
    getCreativePipeline(storeId, from, to),
    getFrameworkOverview(storeId),
  ]);

  const contenido = [
    `## Resumen creativo y de mensaje`,
    `En **${toDateLabel(from, to)}**, **${store?.nombre || 'Tienda'}** trabajó con **${pipeline?.summary?.adsConSpend || 0} ads con spend**, de los cuales **${pipeline?.summary?.escalar || 0}** muestran señal para escalar, **${pipeline?.summary?.pausar || 0}** piden revisión y **${pipeline?.summary?.testear || 0}** aparecen como backlog de test.`,
    '',
    `## Lectura del pipeline`,
    ...(pipeline?.escalar?.length
      ? pipeline.escalar.slice(0, 4).map((item) => `- **Escalar:** ${item.title}. ${item.reason}`)
      : ['- No hay ganadores claros para escalar todavía.']),
    ...(pipeline?.pausar?.length
      ? pipeline.pausar.slice(0, 4).map((item) => `- **Revisar / pausar:** ${item.title}. ${item.reason}`)
      : ['- No hay piezas de bajo rendimiento claramente detectadas.']),
    ...(pipeline?.testear?.length
      ? pipeline.testear.slice(0, 4).map((item) => `- **Testear:** ${item.title}. ${item.reason}`)
      : ['- No hay backlog nuevo de tests detectado automáticamente.']),
    '',
    `## Framework de mensaje`,
    `- **Topics cargados:** ${framework?.summary?.topics || 0}`,
    `- **Hooks cargados:** ${framework?.summary?.hooks || 0}`,
    `- **Objeciones registradas:** ${framework?.summary?.objections || 0}`,
    `- **Objeciones sin respuesta:** ${framework?.summary?.unresolvedObjections || 0}`,
    `- **Competidores cargados:** ${framework?.summary?.competitors || 0}`,
    '',
    `## Gaps que importan`,
    ...(framework?.strategicGaps?.missingResponses?.length
      ? framework.strategicGaps.missingResponses.slice(0, 4).map((item) => `- Falta resolver la objeción: ${item.texto}.`)
      : ['- No aparecen objeciones críticas sin respuesta.']),
    ...(framework?.strategicGaps?.competitorAngles?.length
      ? framework.strategicGaps.competitorAngles.slice(0, 4).map((item) => `- Ángulo a explorar: ${item}.`)
      : []),
    ...(framework?.strategicGaps?.competitorTerritories?.length
      ? framework.strategicGaps.competitorTerritories.slice(0, 4).map((item) => `- Territorio a explorar: ${item}.`)
      : []),
    '',
    `## Recomendación ejecutiva`,
    `- Resolver primero objeciones sin respuesta antes de sumar volumen de piezas nuevas.`,
    `- Escalar solo creativos con spend y señal real, no piezas sin delivery suficiente.`,
    `- Transformar este backlog en próximos tests concretos por ángulo, territorio y avatar.`,
    '',
    `## Próximos pasos sugeridos`,
    `1. Elegir 1 o 2 ganadores para escalar con una hipótesis clara.`,
    `2. Bajar el número de piezas flojas que solo agregan ruido al aprendizaje.`,
    `3. Construir próximos tests desde mensaje y objeción, no solo desde formato visual.`,
  ].join('\n');

  return {
    titulo: `Reporte creativo y mensaje · ${store?.nombre || 'Tienda'} · ${toDateLabel(from, to)}`,
    section: 'creativos',
    tipo: 'report',
    summary: `Escalar ${pipeline?.summary?.escalar || 0} · Pausar ${pipeline?.summary?.pausar || 0} · Testear ${pipeline?.summary?.testear || 0}`,
    contenido,
    confidence: creativeContext.dataQuality?.confidence ?? 0.5,
    qualityNote: creativeContext.dataQuality?.note || '',
    generationMode: 'manual',
    snapshot: {
      metrics: creativeContext,
      pipeline,
      framework,
    },
  };
}

async function buildTemplateReport(templateKey, storeId, from, to, userId) {
  if (templateKey === 'executive') return buildExecutiveReport(storeId, from, to, userId);
  if (templateKey === 'meta-performance') return buildMetaPerformanceReport(storeId, from, to, userId);
  if (templateKey === 'creative-framework') return buildCreativeFrameworkReport(storeId, from, to, userId);
  throw new Error('Template de reporte no soportado');
}

module.exports = {
  buildTemplateReport,
};
