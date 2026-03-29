const aiService = require('../services/aiService');

exports.analyze = async (req, res) => {
  try {
    const { section, from, to } = req.body;
    const result = await aiService.analyze(section || 'dashboard', req.params.id, from, to);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.chat = async (req, res) => {
  try {
    const { messages, from, to } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }
    const result = await aiService.chat(messages, req.params.id, from, to);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.testConnection = async (req, res) => {
  try {
    const result = await aiService.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
