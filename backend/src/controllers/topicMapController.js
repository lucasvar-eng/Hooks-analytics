const TopicMap = require('../models/TopicMap');

exports.list = async (req, res) => {
  const topicMaps = await TopicMap.find({ storeId: req.params.id }).sort({ nombre: 1 });
  res.json(topicMaps);
};

exports.create = async (req, res) => {
  const { nombre, status, description, performanceNotes } = req.body;
  const topicMap = await TopicMap.create({ storeId: req.params.id, nombre, status, description, performanceNotes });
  res.status(201).json(topicMap);
};

exports.update = async (req, res) => {
  const { nombre, status, description, performanceNotes } = req.body;
  const topicMap = await TopicMap.findOneAndUpdate(
    { _id: req.params.topicMapId, storeId: req.params.id },
    { nombre, status, description, performanceNotes },
    { new: true }
  );
  if (!topicMap) return res.status(404).json({ error: 'Not found' });
  res.json(topicMap);
};

exports.remove = async (req, res) => {
  await TopicMap.findOneAndDelete({ _id: req.params.topicMapId, storeId: req.params.id });
  res.json({ message: 'Deleted' });
};
