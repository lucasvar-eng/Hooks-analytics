const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  tipo: { type: String, enum: ['analysis', 'report', 'diagnostic'], default: 'analysis' },
  titulo: { type: String, required: true },
  contenido: { type: String, required: true }, // markdown
  section: { type: String }, // which page generated it (dashboard, meta, etc)
  dateRange: {
    from: { type: Date },
    to: { type: Date },
  },
  tokensUsed: { type: Number, default: 0 },
  model: { type: String },
  createdAt: { type: Date, default: Date.now },
});

reportSchema.index({ storeId: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
