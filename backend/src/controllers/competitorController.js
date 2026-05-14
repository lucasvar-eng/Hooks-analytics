const Competitor = require('../models/Competitor');
const aiService = require('../services/aiService');
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

exports.analyze = async (req, res) => {
  try {
    const competitor = await Competitor.findOne({ _id: req.params.competitorId, storeId: req.params.id });
    if (!competitor) return res.status(404).json({ error: 'Competidor no encontrado' });

    // Get last 30 days
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);

    const result = await aiService.analyze(
      'competencia',
      req.params.id,
      from.toISOString().split('T')[0],
      to.toISOString().split('T')[0],
      req.user._id
    );

    // Snapshot del análisis anterior antes de pisarlo
    await snapshotService.createSnapshot(competitor._id, {
      source: 'analyze',
      userId: req.user?._id,
    });

    competitor.analysisResult = result.analysis;
    competitor.lastAnalysis = new Date();
    await competitor.save();

    res.json({ analysis: result.analysis, tokensUsed: result.tokensUsed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.opportunities = async (req, res) => {
  try {
    const competitor = await Competitor.findOne({ _id: req.params.competitorId, storeId: req.params.id });
    if (!competitor) return res.status(404).json({ error: 'Competidor no encontrado' });

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);

    const result = await aiService.generateWorkflow(
      'competitor_opportunities',
      req.params.id,
      from.toISOString().split('T')[0],
      to.toISOString().split('T')[0],
      req.user._id,
      {
        competitor: {
          nombre: competitor.nombre,
          url: competitor.url,
          notas: competitor.notas,
          analysisResult: competitor.analysisResult,
        },
      }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
