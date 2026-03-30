const mongoose = require('mongoose');

const widgetSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    pageId: { type: String, required: true, default: 'dashboard' },
    type: {
      type: String,
      enum: ['kpi', 'kpi-group', 'table', 'note', 'separator', 'metric-card', 'chart', 'mini-analysis'],
      required: true,
    },
    title: { type: String, required: true },
    size: { type: String, enum: ['sm', 'md', 'lg', 'full'], default: 'sm' },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

widgetSchema.index({ storeId: 1, pageId: 1 });

module.exports = mongoose.model('Widget', widgetSchema);
