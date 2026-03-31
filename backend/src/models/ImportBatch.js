const mongoose = require('mongoose');

const importBatchSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    type: {
      type: String,
      enum: ['orders', 'products', 'customers', 'costos', 'meta_csv', 'meta_api'],
      required: true,
    },
    source: {
      type: String,
      enum: ['csv', 'api', 'manual', 'sync'],
      required: true,
    },
    sourceFileName: { type: String },
    status: {
      type: String,
      enum: ['pending', 'validated', 'completed', 'failed', 'partial'],
      default: 'pending',
    },
    rowsTotal: { type: Number, default: 0 },
    rowsAccepted: { type: Number, default: 0 },
    rowsRejected: { type: Number, default: 0 },
    warnings: [{ type: String }],
    conflicts: [{ type: String }],
    validationErrors: [{ type: String }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

importBatchSchema.index({ storeId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('ImportBatch', importBatchSchema);
