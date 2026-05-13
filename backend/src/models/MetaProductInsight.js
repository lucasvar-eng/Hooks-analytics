const mongoose = require('mongoose');

const metaProductInsightSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    adAccountId: { type: String },
    adId: { type: String, required: true },         // Meta ad id where the breakdown was reported
    adsetId: { type: String },
    campaignId: { type: String },

    metaProductId: { type: String, required: true }, // catalog product id reported by Meta
    productName: { type: String },                   // human name from breakdown (Meta sends "<id>, <name>")
    tnProductId: { type: String },                   // best-effort match against Product.tnProductId via normalized name

    date: { type: Date, required: true },
    source: { type: String, enum: ['api', 'csv'], default: 'api' },

    spend: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    linkClicks: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },

    // Actions are usually not attributed at product breakdown level in Meta,
    // but the fields are kept for future endpoints (e.g. catalog product report).
    purchases: { type: Number, default: 0 },
    purchaseValue: { type: Number, default: 0 },
    atc: { type: Number, default: 0 },
    checkouts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

metaProductInsightSchema.index(
  { storeId: 1, adId: 1, metaProductId: 1, date: 1, source: 1 },
  { unique: true }
);
metaProductInsightSchema.index({ storeId: 1, date: -1 });
metaProductInsightSchema.index({ storeId: 1, tnProductId: 1, date: -1 });

module.exports = mongoose.model('MetaProductInsight', metaProductInsightSchema);
