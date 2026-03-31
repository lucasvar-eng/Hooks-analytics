const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  tipo: { type: String, enum: ['analysis', 'report', 'diagnostic'], default: 'analysis' },
  titulo: { type: String, required: true },
  contenido: { type: String, required: true }, // markdown
  section: { type: String }, // which page generated it (dashboard, meta, etc)
  summary: { type: String, default: '' },
  dateRange: {
    from: { type: Date },
    to: { type: Date },
  },
  snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  exportVersion: { type: Number, default: 1 },
  tokensUsed: { type: Number, default: 0 },
  model: { type: String },
  provider: { type: String },
  confidence: { type: Number, default: null },
  qualityNote: { type: String, default: '' },
  generationMode: { type: String, enum: ['ai', 'fallback', 'manual'], default: 'manual' },
  createdAt: { type: Date, default: Date.now },
});

reportSchema.index({ storeId: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
