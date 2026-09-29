const mongoose = require('mongoose');

const competitorAdSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    competitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competitor', required: true, index: true },

    platform: {
      type: String,
      enum: ['meta', 'google', 'youtube', 'tiktok', 'microsoft', 'other'],
      required: true,
      default: 'meta',
      index: true,
    },
    sourceUrl: { type: String },
    externalAdId: { type: String },
    advertiserName: { type: String },
    advertiserId: { type: String },

    status: {
      type: String,
      enum: ['active', 'inactive', 'unknown'],
      default: 'unknown',
      index: true,
    },
    format: {
      type: String,
      enum: ['image', 'video', 'carousel', 'search', 'display', 'shopping', 'unknown'],
      default: 'unknown',
    },
    firstSeenAt: { type: Date, default: Date.now, index: true },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    startedAt: { type: Date },
    endedAt: { type: Date },
    countries: [{ type: String }],

    primaryText: { type: String },
    headline: { type: String },
    description: { type: String },
    cta: { type: String },
    landingUrl: { type: String },
    mediaUrl: { type: String },
    thumbnailUrl: { type: String },

    hook: { type: String },
    angle: { type: String },
    avatar: { type: String },
    awarenessLevel: {
      type: String,
      enum: ['unaware', 'problem-aware', 'solution-aware', 'product-aware', 'most-aware', 'unknown'],
      default: 'unknown',
    },
    offer: { type: String },
    objection: { type: String },
    notes: { type: String },
    tags: [{ type: String }],

    source: {
      type: String,
      enum: ['manual', 'mcp', 'scanner', 'import'],
      default: 'manual',
      index: true,
    },
    confidence: { type: Number, min: 0, max: 1 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

competitorAdSchema.index(
  { competitorId: 1, platform: 1, externalAdId: 1 },
  { unique: true, sparse: true }
);
competitorAdSchema.index({ storeId: 1, platform: 1, status: 1 });

module.exports = mongoose.model('CompetitorAd', competitorAdSchema);
