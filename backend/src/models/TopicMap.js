const mongoose = require('mongoose');

const topicMapSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    nombre: { type: String, required: true },
    status: { type: String, enum: ['draft', 'active', 'paused'], default: 'draft' },
    description: { type: String },
    performanceNotes: { type: String },
  },
  { timestamps: true }
);

topicMapSchema.index({ storeId: 1 });

module.exports = mongoose.model('TopicMap', topicMapSchema);
