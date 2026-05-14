const Report = require('../models/Report');
const { aggregateRange } = require('../services/metricCalculator');
const { getEffectiveTarget } = require('../services/targetService');
const { logAudit } = require('../services/auditLogService');

function buildSummary(metrics, target) {
  const summary = [];
  if (metrics.revenue) summary.push(`Revenue ${Math.round(metrics.revenue).toLocaleString('es-AR')}`);
  if (metrics.profit || metrics.profit === 0) summary.push(`Profit ${Math.round(metrics.profit).toLocaleString('es-AR')}`);
  if (metrics.trueRoas) summary.push(`True ROAS ${metrics.trueRoas.toFixed(2)}x`);
  if (target?.kpis?.roasTarget) summary.push(`Target ROAS ${target.kpis.roasTarget.toFixed(2)}x`);
  return summary.join(' · ');
}

exports.list = async (req, res) => {
  const reports = await Report.find({ storeId: req.params.id })
    .sort({ createdAt: -1 })
    .limit(100)
    .select('-contenido');
  res.json(reports);
};

exports.getById = async (req, res) => {
  const report = await Report.findOne({ _id: req.params.reportId, storeId: req.params.id });
  if (!report) return res.status(404).json({ error: 'Not found' });
  res.json(report);
};

exports.create = async (req, res) => {
  const { titulo, contenido, section, tipo, dateRange, tokensUsed, model, provider, confidence, qualityNote, generationMode } = req.body;
  let snapshot = req.body.snapshot || null;
  let target = null;

  if (dateRange?.from && dateRange?.to && !snapshot) {
    const metrics = await aggregateRange(req.params.id, dateRange.from, dateRange.to);
    target = await getEffectiveTarget(req.params.id, dateRange);
    snapshot = {
      metrics,
      target,
      sourceCoverage: metrics.sourceCoverage || {},
    };
  }

  const report = await Report.create({
    storeId: req.params.id,
    titulo,
    contenido,
    summary: req.body.summary || buildSummary(snapshot?.metrics || {}, target || snapshot?.target),
    section,
    tipo,
    dateRange,
    snapshot,
    tokensUsed,
    model,
    provider,
    confidence,
    qualityNote,
    generationMode: generationMode || 'manual',
  });

  await logAudit({
    storeId: req.params.id,
    userId: req.user?._id,
    action: 'report.created',
    entityType: 'Report',
    entityId: report._id,
    details: { section, tipo },
  });

  res.status(201).json(report);
};

exports.exportReport = async (req, res) => {
  const format = req.query.format === 'json' ? 'json' : 'markdown';
  const report = await Report.findOne({ _id: req.params.reportId, storeId: req.params.id }).lean();
  if (!report) return res.status(404).json({ error: 'Not found' });

  if (format === 'json') {
    return res.json({
      reportId: report._id,
      titulo: report.titulo,
      tipo: report.tipo,
      section: report.section,
      dateRange: report.dateRange,
      summary: report.summary,
      contenido: report.contenido,
      snapshot: report.snapshot,
      provider: report.provider,
      confidence: report.confidence,
      qualityNote: report.qualityNote,
      generationMode: report.generationMode,
      createdAt: report.createdAt,
    });
  }

  const lines = [
    `# ${report.titulo}`,
    '',
    `Tipo: ${report.tipo}`,
    report.section ? `Sección: ${report.section}` : null,
    report.summary ? `Resumen: ${report.summary}` : null,
    report.generationMode ? `Generación: ${report.generationMode}` : null,
    report.provider ? `Proveedor: ${report.provider}` : null,
    report.model ? `Modelo: ${report.model}` : null,
    report.confidence != null ? `Confianza: ${(report.confidence * 100).toFixed(0)}%` : null,
    report.qualityNote ? `Nota: ${report.qualityNote}` : null,
    report.dateRange?.from ? `Desde: ${new Date(report.dateRange.from).toISOString().slice(0, 10)}` : null,
    report.dateRange?.to ? `Hasta: ${new Date(report.dateRange.to).toISOString().slice(0, 10)}` : null,
    '',
    report.contenido,
  ].filter(Boolean);

  res.type('text/markdown').send(lines.join('\n'));
};

exports.remove = async (req, res) => {
  await Report.findOneAndDelete({ _id: req.params.reportId, storeId: req.params.id });
  res.json({ message: 'Deleted' });
};

// El template-builder vivía adentro de la app y generaba reportes con texto
// hardcodeado. Ahora la IA externa entra por MCP, agarra los esqueletos de
// template, los completa, y sube el reporte vía POST /reports.
exports.createFromTemplate = async (req, res) => {
  res.status(410).json({
    error: 'Endpoint deprecado. Los reportes ahora los sube la IA externa vía MCP (tool create_report). El Sprint 2 expone los esqueletos de templates como recurso MCP.',
  });
};
