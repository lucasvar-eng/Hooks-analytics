const User = require('../models/User');
const { encrypt } = require('../utils/encryption');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');

exports.getAIConfig = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('+aiConfig.apiKeyEncrypted');

    const hasApiKey = !!user.aiConfig?.apiKeyEncrypted;
    const envFallbackAvailable = Boolean(ai.anthropicApiKey || ai.openaiApiKey);

    res.json({
      provider: user.aiConfig?.provider || 'anthropic',
      hasApiKey,
      modelAnalysis: user.aiConfig?.modelAnalysis || '',
      modelChat: user.aiConfig?.modelChat || '',
      modelReports: user.aiConfig?.modelReports || '',
      globalInstructions: user.aiConfig?.globalInstructions || '',
      globalFiles: (user.aiConfig?.globalFiles || []).map((f) => ({
        filename: f.filename,
        uploadedAt: f.uploadedAt,
      })),
      readiness: {
        ready: hasApiKey || envFallbackAvailable,
        mode: hasApiKey ? 'user_key' : envFallbackAvailable ? 'env_fallback' : 'missing',
        envFallbackAvailable,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateAIConfig = async (req, res, next) => {
  try {
    const { provider, apiKey, modelAnalysis, modelChat, modelReports } = req.body;
    const update = {};

    if (provider) update['aiConfig.provider'] = provider;
    if (modelAnalysis !== undefined) update['aiConfig.modelAnalysis'] = modelAnalysis;
    if (modelChat !== undefined) update['aiConfig.modelChat'] = modelChat;
    if (modelReports !== undefined) update['aiConfig.modelReports'] = modelReports;

    // Encrypt API key if provided
    if (apiKey) {
      const { encrypted, iv, authTag } = encrypt(apiKey);
      update['aiConfig.apiKeyEncrypted'] = encrypted;
      update['aiConfig.apiKeyIV'] = iv;
      update['aiConfig.apiKeyAuthTag'] = authTag;
    }

    await User.findByIdAndUpdate(req.user._id, { $set: update });

    logger.info(`AI config updated for user ${req.user.email}`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

exports.updateGlobalInstructions = async (req, res, next) => {
  try {
    const { instructions } = req.body;
    if (typeof instructions !== 'string') {
      return res.status(400).json({ error: 'instructions must be a string' });
    }
    if (instructions.length > 10000) {
      return res.status(400).json({ error: 'Instructions too long (max 10,000 chars)' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $set: { 'aiConfig.globalInstructions': instructions },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

exports.uploadGlobalFile = async (req, res, next) => {
  try {
    const { filename, content } = req.body;
    if (!filename || !content) {
      return res.status(400).json({ error: 'filename and content required' });
    }
    if (content.length > 50000) {
      return res.status(400).json({ error: 'File too large (max 50KB text)' });
    }

    const user = await User.findById(req.user._id);
    if ((user.aiConfig?.globalFiles?.length || 0) >= 5) {
      return res.status(400).json({ error: 'Máximo 5 archivos. Eliminá uno antes de subir otro.' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $push: { 'aiConfig.globalFiles': { filename, content, uploadedAt: new Date() } },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

exports.deleteGlobalFile = async (req, res, next) => {
  try {
    const { filename } = req.params;
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { 'aiConfig.globalFiles': { filename } },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

exports.testConnection = async (req, res, next) => {
  try {
    const result = await aiService.testConnection(req.user._id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
