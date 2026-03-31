const Competitor = require('../models/Competitor');
const aiService = require('../services/aiService');

exports.list = async (req, res) => {
  const competitors = await Competitor.find({ storeId: req.params.id }).sort({ nombre: 1 });
  res.json(competitors);
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
  const competitor = await Competitor.findOneAndUpdate(
    { _id: req.params.competitorId, storeId: req.params.id },
    { nombre, url, positioning, avatar, awarenessLevel, mainOffer, angles, territories, objectionsDetected, notas },
    { new: true }
  );
  if (!competitor) return res.status(404).json({ error: 'Not found' });
  res.json(competitor);
};

exports.remove = async (req, res) => {
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

    // Enrich the prompt context with competitor info
    // The analysis already includes store data; save result to competitor
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
