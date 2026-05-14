const Competitor = require('../models/Competitor');
const { getCompetitorOverview } = require('../services/contentStrategyService');
const snapshotService = require('../services/competitorSnapshotService');
const { scrapeCompetitor } = require('../services/competitorScrapeService');

exports.list = async (req, res) => {
  const competitors = await Competitor.find({ storeId: req.params.id }).sort({ nombre: 1 });
  res.json(competitors);
};

exports.overview = async (req, res) => {
  const overview = await getCompetitorOverview(req.params.id);
  res.json(overview);
};

exports.create = async (req, res) => {
  const {
    nombre,
    url,
    positioning,
    avatar,
    awarenessLevel,
    mainOffer,
    angles,
    territories,
    objectionsDetected,
    notas,
  } = req.body;
  const competitor = await Competitor.create({
    storeId: req.params.id,
    nombre,
    url,
    positioning,
    avatar,
    awarenessLevel,
    mainOffer,
    angles,
    territories,
    objectionsDetected,
    notas,
  });
  res.status(201).json(competitor);
};

exports.update = async (req, res) => {
  const {
    nombre,
    url,
    positioning,
    avatar,
    awarenessLevel,
    mainOffer,
    angles,
    territories,
    objectionsDetected,
    notas,
  } = req.body;

  // Snapshot del estado anterior antes de pisar (si hay cambios reales)
  await snapshotService.createSnapshot(req.params.competitorId, {
    source: 'update',
    userId: req.user?._id,
  });

  const competitor = await Competitor.findOneAndUpdate(
    { _id: req.params.competitorId, storeId: req.params.id },
    { nombre, url, positioning, avatar, awarenessLevel, mainOffer, angles, territories, objectionsDetected, notas },
    { new: true }
  );
  if (!competitor) return res.status(404).json({ error: 'Not found' });
  res.json(competitor);
};

exports.remove = async (req, res) => {
  await snapshotService.deleteAllForCompetitor(req.params.competitorId);
  await Competitor.findOneAndDelete({ _id: req.params.competitorId, storeId: req.params.id });
  res.json({ message: 'Deleted' });
};

// El análisis con AI ahora vive fuera de la app (vía MCP). La IA externa lee
// el contexto del competidor y sube el análisis usando el endpoint update
// (campo `analysisResult` + `lastAnalysis`). Estos dos endpoints quedaron
// como stubs para mantener compatibilidad con el frontend viejo.
exports.analyze = async (req, res) => {
  res.status(410).json({
    error: 'Endpoint deprecado. El análisis con AI se hace ahora vía MCP — la IA externa actualiza el competidor directamente con PUT /competitors/:id incluyendo analysisResult.',
  });
};

exports.opportunities = async (req, res) => {
  res.status(410).json({
    error: 'Endpoint deprecado. Las oportunidades se generan ahora vía MCP — la IA externa lee el competidor, redacta sugerencias y las sube como Insight o Report.',
  });
};

/**
 * Scrape del sitio del competidor. Devuelve preview (sugerencias) sin aplicar
 * cambios al competidor. Si el cliente quiere aplicarlas, llama a `update`
 * con los campos elegidos.
 */
exports.scrape = async (req, res) => {
  try {
    const result = await scrapeCompetitor(req.params.competitorId, req.params.id);
    res.json(result);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ error: error.message });
  }
};

/**
 * Aplica sugerencias del scrape a los campos vacíos del competidor.
 * Solo pisa campos que el competidor tiene en blanco — no sobreescribe data manual.
 *
 * Body: { positioning, mainOffer, ... } (solo los campos a aplicar)
 * Query: ?force=true para sobreescribir incluso si el campo tenía valor.
 */
exports.applyScrape = async (req, res) => {
  try {
    const competitor = await Competitor.findOne({
      _id: req.params.competitorId,
      storeId: req.params.id,
    });
    if (!competitor) return res.status(404).json({ error: 'Competidor no encontrado' });

    const force = req.query.force === 'true';
    const allowedFields = ['positioning', 'mainOffer', 'avatar', 'awarenessLevel', 'notas'];
    const updates = {};
    for (const f of allowedFields) {
      if (req.body[f] === undefined || req.body[f] === null) continue;
      const newVal = String(req.body[f]).trim();
      if (!newVal) continue;
      const currVal = (competitor[f] || '').trim?.() ?? competitor[f];
      if (force || !currVal) {
        updates[f] = newVal;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.json({ updated: false, message: 'No hay campos para aplicar (todos ya tienen valor — pasá force=true para sobreescribir)' });
    }

    await snapshotService.createSnapshot(competitor._id, {
      source: 'scrape',
      userId: req.user?._id,
    });

    Object.assign(competitor, updates);
    await competitor.save();

    res.json({ updated: true, applied: Object.keys(updates), competitor });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Lista de snapshots del competidor (timeline de cambios).
 */
exports.listSnapshots = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const snapshots = await snapshotService.listSnapshots(req.params.competitorId, { limit });
    res.json(snapshots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Diff entre el estado actual y el último snapshot.
 * Útil para mostrar "qué cambió desde el último análisis".
 */
exports.latestDiff = async (req, res) => {
  try {
    const diff = await snapshotService.getLatestDiff(req.params.competitorId);
    if (!diff) return res.status(404).json({ error: 'Competidor no encontrado' });
    res.json(diff);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
