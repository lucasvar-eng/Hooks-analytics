const mongoose = require('mongoose');

const topicMapSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    nombre: { type: String, required: true },
    status: { type: String, enum: ['draft', 'active', 'paused'], default: 'draft' },
    priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    avatar: { type: String },
    awarenessLevel: {
      type: String,
      enum: ['unaware', 'problem-aware', 'solution-aware', 'product-aware', 'most-aware', 'unknown'],
      default: 'unknown',
    },
    angle: { type: String },
    territory: { type: String },
    symptom: { type: String },
    objection: { type: String },
    recommendedFormat: { type: String },
    stage: { type: String, enum: ['testing', 'scaling', 'saturated', 'paused', 'unknown'], default: 'unknown' },
    hypothesis: { type: String },
    tags: [{ type: String }],
    description: { type: String },
    performanceNotes: { type: String },
  },
  { timestamps: true }
);

topicMapSchema.index({ storeId: 1 });

module.exports = mongoose.model('TopicMap', topicMapSchema);
