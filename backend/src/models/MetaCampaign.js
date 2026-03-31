const mongoose = require('mongoose');

const metaCampaignSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    adAccountId: { type: String },
    metaId: { type: String, required: true },
    nombre: { type: String },
    status: { type: String, enum: ['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED'] },
    level: { type: String, enum: ['campaign', 'adset', 'ad'], required: true },
    parentId: { type: String }, // campaign metaId for adsets, adset metaId for ads
    objective: { type: String },
    budget: { type: Number, default: 0 },
    budgetType: { type: String, enum: ['daily', 'lifetime'] },
    thumbnailUrl: { type: String },
    // Ad-level fields
    creativeName: { type: String },
    creativeBody: { type: String },
    creativeTitle: { type: String },
  },
  { timestamps: true }
);

metaCampaignSchema.index({ storeId: 1, metaId: 1 }, { unique: true });
metaCampaignSchema.index({ storeId: 1, level: 1 });
metaCampaignSchema.index({ storeId: 1, parentId: 1 });

module.exports = mongoose.model('MetaCampaign', metaCampaignSchema);
