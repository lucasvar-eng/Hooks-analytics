const mongoose = require('mongoose');

const importLogSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    type: { type: String, default: 'meta_csv' },
    importBatchId: { type: String },
    fileName: { type: String },
    rowsImported: { type: Number, default: 0 },
    rowsTotal: { type: Number, default: 0 },
    errors: [{ type: String }],
    dateRangeFrom: { type: Date },
    dateRangeTo: { type: Date },
    columnsDetected: [{ type: String }],
    columnsMissing: [{ type: String }],
    status: { type: String, enum: ['success', 'partial', 'error'], default: 'success' },
  },
  { timestamps: true }
);

importLogSchema.index({ storeId: 1, createdAt: -1 });

module.exports = mongoose.model('ImportLog', importLogSchema);
