const User = require('../models/User');
const { encrypt, decrypt } = require('../utils/encryption');
const { getProvider } = require('../services/aiProviders');
const logger = require('../utils/logger');

exports.getAIConfig = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('+aiConfig.apiKeyEncrypted');

    const hasApiKey = !!user.aiConfig?.apiKeyEncrypted;

    res.json({
      provider: user.aiConfig?.provider || 'anthropic',
      hasApiKey,
      modelAnalysis: user.aiConfig?.modelAnalysis || '',
      modelChat: user.aiConfig?.modelChat || '',
      globalInstructions: user.aiConfig?.globalInstructions || '',
      globalFiles: (user.aiConfig?.globalFiles || []).map((f) => ({
        filename: f.filename,
        uploadedAt: f.uploadedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

exports.updateAIConfig = async (req, res, next) => {
  try {
    const { provider, apiKey, modelAnalysis, modelChat } = req.body;
    const update = {};

    if (provider) update['aiConfig.provider'] = provider;
    if (modelAnalysis !== undefined) update['aiConfig.modelAnalysis'] = modelAnalysis;
    if (modelChat !== undefined) update['aiConfig.modelChat'] = modelChat;

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
    const user = await User.findById(req.user._id)
      .select('+aiConfig.apiKeyEncrypted +aiConfig.apiKeyIV +aiConfig.apiKeyAuthTag');

    let provider = user.aiConfig?.provider || 'anthropic';
    let apiKey;

    if (user.aiConfig?.apiKeyEncrypted) {
      apiKey = decrypt(user.aiConfig.apiKeyEncrypted, user.aiConfig.apiKeyIV, user.aiConfig.apiKeyAuthTag);
    } else {
      const { ai } = require('../config/environment');
      if (!ai.anthropicApiKey) {
        return res.status(400).json({ error: 'No hay API key configurada (ni personal ni en .env)' });
      }
      apiKey = ai.anthropicApiKey;
      provider = 'anthropic';
    }

    const client = getProvider(provider, apiKey);
    const testModel = provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini';

    await client.createMessage({
      model: testModel,
      maxTokens: 10,
      system: 'Respond OK',
      messages: [{ role: 'user', content: 'test' }],
    });

    res.json({ status: 'ok', provider });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
