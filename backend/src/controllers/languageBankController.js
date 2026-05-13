const LanguageBank = require('../models/LanguageBank');
const { getLanguageBankOverview } = require('../services/contentStrategyService');

exports.list = async (req, res) => {
  const filter = { storeId: req.params.id };
  if (req.query.tipo) filter.tipo = req.query.tipo;
  const entries = await LanguageBank.find(filter).sort({ createdAt: -1 });
  res.json(entries);
};

exports.overview = async (req, res) => {
  const overview = await getLanguageBankOverview(req.params.id);
  res.json(overview);
};

exports.create = async (req, res) => {
  const { tipo, texto, response, tags, sentiment, avatar, awarenessLevel, angle, territory, objectionStage } = req.body;
  const entry = await LanguageBank.create({
    storeId: req.params.id,
    tipo,
    texto,
    response,
    tags,
    sentiment,
    avatar,
    awarenessLevel,
    angle,
    territory,
    objectionStage,
  });
  res.status(201).json(entry);
};

exports.update = async (req, res) => {
  const { tipo, texto, response, tags, sentiment, avatar, awarenessLevel, angle, territory, objectionStage } = req.body;
  const entry = await LanguageBank.findOneAndUpdate(
    { _id: req.params.entryId, storeId: req.params.id },
    { tipo, texto, response, tags, sentiment, avatar, awarenessLevel, angle, territory, objectionStage },
    { new: true }
  );
  if (!entry) return res.status(404).json({ error: 'Not found' });
  res.json(entry);
};

exports.remove = async (req, res) => {
  await LanguageBank.findOneAndDelete({ _id: req.params.entryId, storeId: req.params.id });
  res.json({ message: 'Deleted' });
};
