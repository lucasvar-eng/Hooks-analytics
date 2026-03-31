const mongoose = require('mongoose');

const automationRuleSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['executive_summary', 'anomaly_watch', 'creative_review', 'catalog_health'],
      required: true,
    },
    frequency: { type: String, enum: ['daily', 'weekly', 'manual'], default: 'manual' },
    active: { type: Boolean, default: true },
    config: {
      fromDaysBack: { type: Number, default: 7 },
      notes: { type: String, default: '' },
    },
    lastRunAt: { type: Date, default: null },
    lastStatus: { type: String, enum: ['idle', 'success', 'error'], default: 'idle' },
    lastError: { type: String, default: '' },
    lastReportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null },
  },
  { timestamps: true }
);

automationRuleSchema.index({ storeId: 1, createdAt: -1 });

module.exports = mongoose.model('AutomationRule', automationRuleSchema);
