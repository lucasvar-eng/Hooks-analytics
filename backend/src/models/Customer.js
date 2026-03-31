const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    externalCustomerId: { type: String, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    firstPurchase: { type: Date },
    cohortMonth: { type: String }, // '2026-03'
    lastOrderDate: { type: Date },

    // RFM (Sprint 7)
    recency: { type: Number },     // days since last order
    frequency: { type: Number },   // total orders
    monetary: { type: Number },    // total spent
    rfmScore: { type: String },    // e.g. '5-4-5'
    rfmSegment: { type: String },  // 'champions', 'loyal', 'at_risk', 'lost', etc.
    ltv: { type: Number, default: 0 },
    repurchaseRate: { type: Number, default: 0 },
    firstToSecondOrderLag: { type: Number },
    purchaseDensity: { type: Number, default: 0 },
  },
  { timestamps: true }
);

customerSchema.index({ storeId: 1, email: 1 }, { unique: true });
customerSchema.index({ storeId: 1, externalCustomerId: 1 }, { unique: true, sparse: true });
customerSchema.index({ storeId: 1, cohortMonth: 1 });

module.exports = mongoose.model('Customer', customerSchema);
