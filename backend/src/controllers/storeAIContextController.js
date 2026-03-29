const Store = require('../models/Store');

exports.getAIContext = async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id).select('aiContext');
    if (!store) return res.status(404).json({ error: 'Store not found' });

    res.json({
      instructions: store.aiContext?.instructions || '',
      files: (store.aiContext?.files || []).map((f) => ({
        filename: f.filename,
        uploadedAt: f.uploadedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

exports.updateAIContext = async (req, res, next) => {
  try {
    const { instructions } = req.body;
    if (typeof instructions !== 'string') {
      return res.status(400).json({ error: 'instructions must be a string' });
    }
    if (instructions.length > 10000) {
      return res.status(400).json({ error: 'Instructions too long (max 10,000 chars)' });
    }

    await Store.findByIdAndUpdate(req.params.id, {
      $set: { 'aiContext.instructions': instructions },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

exports.uploadStoreFile = async (req, res, next) => {
  try {
    const { filename, content } = req.body;
    if (!filename || !content) {
      return res.status(400).json({ error: 'filename and content required' });
    }
    if (content.length > 50000) {
      return res.status(400).json({ error: 'File too large (max 50KB text)' });
    }

    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    if ((store.aiContext?.files?.length || 0) >= 5) {
      return res.status(400).json({ error: 'Máximo 5 archivos. Eliminá uno antes de subir otro.' });
    }

    await Store.findByIdAndUpdate(req.params.id, {
      $push: { 'aiContext.files': { filename, content, uploadedAt: new Date() } },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

exports.deleteStoreFile = async (req, res, next) => {
  try {
    await Store.findByIdAndUpdate(req.params.id, {
      $pull: { 'aiContext.files': { filename: req.params.filename } },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
