const Competitor = require('../models/Competitor');

exports.list = async (req, res) => {
  const competitors = await Competitor.find({ storeId: req.params.id }).sort({ nombre: 1 });
  res.json(competitors);
};

exports.create = async (req, res) => {
  const { nombre, url, notas } = req.body;
  const competitor = await Competitor.create({ storeId: req.params.id, nombre, url, notas });
  res.status(201).json(competitor);
};

exports.update = async (req, res) => {
  const { nombre, url, notas } = req.body;
  const competitor = await Competitor.findOneAndUpdate(
    { _id: req.params.competitorId, storeId: req.params.id },
    { nombre, url, notas },
    { new: true }
  );
  if (!competitor) return res.status(404).json({ error: 'Not found' });
  res.json(competitor);
};

exports.remove = async (req, res) => {
  await Competitor.findOneAndDelete({ _id: req.params.competitorId, storeId: req.params.id });
  res.json({ message: 'Deleted' });
};
