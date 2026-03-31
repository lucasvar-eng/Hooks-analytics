const mongoose = require('mongoose');

const fixedCostSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    nombre: { type: String, required: true, trim: true },
    categoria: { type: String, default: 'general' },
    monto: { type: Number, required: true },
    cadence: { type: String, enum: ['monthly', 'weekly', 'daily', 'one_time'], default: 'monthly' },
    periodStart: { type: Date },
    periodEnd: { type: Date },
    active: { type: Boolean, default: true },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

fixedCostSchema.index({ storeId: 1, active: 1, periodStart: -1 });

module.exports = mongoose.model('FixedCost', fixedCostSchema);
