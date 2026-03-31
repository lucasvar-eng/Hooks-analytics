const mongoose = require('mongoose');

const metaDailyInsightSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    adAccountId: { type: String },
    metaId: { type: String, required: true }, // campaign/adset/ad metaId
    date: { type: Date, required: true },
    source: { type: String, enum: ['api', 'csv'], default: 'api' },
    granularity: {
      type: String,
      enum: ['campaign', 'adset', 'ad', 'breakdown'],
      default: 'campaign',
    },
    importBatchId: { type: String },
    sourceFileName: { type: String },

    // Spend
    spend: { type: Number, default: 0 },

    // Reach & Impressions
    impressions: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    frequency: { type: Number, default: 0 },

    // Clicks
    clicks: { type: Number, default: 0 },
    uniqueClicks: { type: Number, default: 0 },
    linkClicks: { type: Number, default: 0 },

    // Rates
    cpm: { type: Number, default: 0 },
    cpc: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 },

    // Conversions
    purchases: { type: Number, default: 0 },
    purchaseValue: { type: Number, default: 0 },
    costPerPurchase: { type: Number, default: 0 },
    atc: { type: Number, default: 0 }, // add to cart
    checkouts: { type: Number, default: 0 },
    leads: { type: Number, default: 0 },

    // Video
    videoViews: { type: Number, default: 0 },
    videoViewsPct25: { type: Number, default: 0 },
    videoViewsPct50: { type: Number, default: 0 },
    videoViewsPct75: { type: Number, default: 0 },
    videoViewsPct100: { type: Number, default: 0 },
    thruPlays: { type: Number, default: 0 },

    // Breakdowns (tu punto 11: fecha, region, genero, edad)
    breakdown: {
      age: { type: String },
      gender: { type: String },
      region: { type: String },
    },
  },
  { timestamps: true }
);

metaDailyInsightSchema.index(
  {
    storeId: 1,
    metaId: 1,
    date: 1,
    source: 1,
    granularity: 1,
    'breakdown.age': 1,
    'breakdown.gender': 1,
    'breakdown.region': 1,
  },
  { unique: true }
);
metaDailyInsightSchema.index({ storeId: 1, date: -1 });

module.exports = mongoose.model('MetaDailyInsight', metaDailyInsightSchema);
