const TopicMap = require('../models/TopicMap');
const { getTopicMapOverview } = require('../services/contentStrategyService');

exports.list = async (req, res) => {
  const topicMaps = await TopicMap.find({ storeId: req.params.id }).sort({ nombre: 1 });
  res.json(topicMaps);
};

exports.overview = async (req, res) => {
  const overview = await getTopicMapOverview(req.params.id);
  res.json(overview);
};

exports.create = async (req, res) => {
  const {
    nombre,
    status,
    priority,
    avatar,
    awarenessLevel,
    angle,
    territory,
    symptom,
    objection,
    recommendedFormat,
    stage,
    hypothesis,
    tags,
    description,
    performanceNotes,
  } = req.body;
  const topicMap = await TopicMap.create({
    storeId: req.params.id,
    nombre,
    status,
    priority,
    avatar,
    awarenessLevel,
    angle,
    territory,
    symptom,
    objection,
    recommendedFormat,
    stage,
    hypothesis,
    tags,
    description,
    performanceNotes,
  });
  res.status(201).json(topicMap);
};

exports.update = async (req, res) => {
  const {
    nombre,
    status,
    priority,
    avatar,
    awarenessLevel,
    angle,
    territory,
    symptom,
    objection,
    recommendedFormat,
    stage,
    hypothesis,
    tags,
    description,
    performanceNotes,
  } = req.body;
  const topicMap = await TopicMap.findOneAndUpdate(
    { _id: req.params.topicMapId, storeId: req.params.id },
    {
      nombre,
      status,
      priority,
      avatar,
      awarenessLevel,
      angle,
      territory,
      symptom,
      objection,
      recommendedFormat,
      stage,
      hypothesis,
      tags,
      description,
      performanceNotes,
    },
    { new: true }
  );
  if (!topicMap) return res.status(404).json({ error: 'Not found' });
  res.json(topicMap);
};

exports.remove = async (req, res) => {
  await TopicMap.findOneAndDelete({ _id: req.params.topicMapId, storeId: req.params.id });
  res.json({ message: 'Deleted' });
};
