const aiService = require('../services/aiService');
const AIConversation = require('../models/AIConversation');

exports.analyze = async (req, res) => {
  try {
    const { section, from, to } = req.body;
    const result = await aiService.analyze(section || 'dashboard', req.params.id, from, to, req.user._id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.chat = async (req, res) => {
  try {
    const { messages, from, to, section } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }
    const currentSection = section || 'dashboard';
    const result = await aiService.chat(messages, req.params.id, from, to, req.user._id, currentSection);

    const persistedMessages = [
      ...messages,
      { role: 'assistant', content: result.response, createdAt: new Date() },
    ]
      .slice(-20)
      .map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt || new Date(),
      }));

    await AIConversation.findOneAndUpdate(
      { storeId: req.params.id, userId: req.user._id, section: currentSection },
      { $set: { messages: persistedMessages } },
      { upsert: true, new: true }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getConversation = async (req, res) => {
  try {
    const section = req.query.section || 'dashboard';
    const conversation = await AIConversation.findOne({
      storeId: req.params.id,
      userId: req.user._id,
      section,
    }).lean();
    res.json({ messages: conversation?.messages || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.clearConversation = async (req, res) => {
  try {
    const section = req.query.section || 'dashboard';
    await AIConversation.findOneAndDelete({
      storeId: req.params.id,
      userId: req.user._id,
      section,
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.generateCreativeBrief = async (req, res) => {
  try {
    const { from, to } = req.body;
    const result = await aiService.generateWorkflow('creative_brief', req.params.id, from, to, req.user._id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.testConnection = async (req, res) => {
  try {
    const result = await aiService.testConnection(req.user._id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
