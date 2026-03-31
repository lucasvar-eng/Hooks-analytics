const mongoose = require('mongoose');

const competitorSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    nombre: { type: String, required: true },
    url: { type: String },
    positioning: { type: String },
    avatar: { type: String },
    awarenessLevel: {
      type: String,
      enum: ['unaware', 'problem-aware', 'solution-aware', 'product-aware', 'most-aware', 'unknown'],
      default: 'unknown',
    },
    mainOffer: { type: String },
    angles: [{ type: String }],
    territories: [{ type: String }],
    objectionsDetected: [{ type: String }],
    notas: { type: String },
    lastAnalysis: { type: Date },
    analysisResult: { type: String }, // markdown from AI
  },
  { timestamps: true }
);

competitorSchema.index({ storeId: 1 });

module.exports = mongoose.model('Competitor', competitorSchema);
