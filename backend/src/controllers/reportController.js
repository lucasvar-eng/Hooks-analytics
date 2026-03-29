const Report = require('../models/Report');

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
  const { titulo, contenido, section, tipo, dateRange, tokensUsed, model } = req.body;
  const report = await Report.create({
    storeId: req.params.id,
    titulo,
    contenido,
    section,
    tipo,
    dateRange,
    tokensUsed,
    model,
  });
  res.status(201).json(report);
};

exports.remove = async (req, res) => {
  await Report.findOneAndDelete({ _id: req.params.reportId, storeId: req.params.id });
  res.json({ message: 'Deleted' });
};
