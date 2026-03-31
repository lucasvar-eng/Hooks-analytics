const mongoose = require('mongoose');

const productCostSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    tnProductId: { type: String, required: true },
    sku: { type: String, trim: true },
    costoUnitario: { type: Number, default: 0 },
    costoEmpaque: { type: Number, default: 0 },
    source: { type: String, enum: ['manual', 'csv', 'sync'], default: 'manual' },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

productCostSchema.index({ storeId: 1, tnProductId: 1, effectiveFrom: -1 });

module.exports = mongoose.model('ProductCost', productCostSchema);
