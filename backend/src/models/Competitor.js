const mongoose = require('mongoose');

const competitorSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    nombre: { type: String, required: true },
    url: { type: String },
    notas: { type: String },
    lastAnalysis: { type: Date },
    analysisResult: { type: String }, // markdown from AI
  },
  { timestamps: true }
);

competitorSchema.index({ storeId: 1 });

module.exports = mongoose.model('Competitor', competitorSchema);
