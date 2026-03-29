const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    firstPurchase: { type: Date },
    cohortMonth: { type: String }, // '2026-03'
    lastOrderDate: { type: Date },
  },
  { timestamps: true }
);

customerSchema.index({ storeId: 1, email: 1 }, { unique: true });
customerSchema.index({ storeId: 1, cohortMonth: 1 });

module.exports = mongoose.model('Customer', customerSchema);
