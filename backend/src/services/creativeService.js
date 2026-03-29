const mongoose = require('mongoose');
const MetaCampaign = require('../models/MetaCampaign');
const MetaDailyInsight = require('../models/MetaDailyInsight');

/**
 * Auto-classify ads into ABCDE tiers based on ROAS and CPA vs averages.
 */
async function autoClassifyAds(storeId, from, to) {
  const dateMatch = {};
  if (from) dateMatch.$gte = new Date(from);
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    dateMatch.$lte = toDate;
  }

  // Get ad-level metrics
  const match = {
    storeId: new mongoose.Types.ObjectId(storeId),
    level: 'ad',
  };

  const ads = await MetaCampaign.find(match).lean();
  if (ads.length === 0) return [];

  // Aggregate insights per ad
  const insightMatch = {
    storeId: new mongoose.Types.ObjectId(storeId),
    metaId: { $in: ads.map((a) => a.metaId) },
  };
  if (from || to) insightMatch.date = dateMatch;

  const insightsAgg = await MetaDailyInsight.aggregate([
    { $match: insightMatch },
    {
      $group: {
        _id: '$metaId',
        spend: { $sum: '$spend' },
        impressions: { $sum: '$impressions' },
        reach: { $sum: '$reach' },
        clicks: { $sum: '$clicks' },
        purchases: { $sum: '$purchases' },
        purchaseValue: { $sum: '$purchaseValue' },
      },
    },
  ]);

  const insightMap = {};
  for (const i of insightsAgg) {
    insightMap[i._id] = i;
  }

  // Calculate derived metrics + averages
  const enriched = ads.map((ad) => {
    const ins = insightMap[ad.metaId] || { spend: 0, impressions: 0, reach: 0, clicks: 0, purchases: 0, purchaseValue: 0 };
    const roas = ins.spend > 0 ? ins.purchaseValue / ins.spend : 0;
    const cpa = ins.purchases > 0 ? ins.spend / ins.purchases : ins.spend > 0 ? Infinity : 0;
    const ctr = ins.impressions > 0 ? (ins.clicks / ins.impressions) * 100 : 0;

    return {
      ...ad,
      metrics: { ...ins, roas, cpa, ctr },
    };
  });

  // Only classify ads with spend
  const withSpend = enriched.filter((a) => a.metrics.spend > 0);
  if (withSpend.length === 0) return enriched.map((a) => ({ ...a, tier: 'E' }));

  const avgRoas = withSpend.reduce((s, a) => s + a.metrics.roas, 0) / withSpend.length;
  const avgCpa = withSpend.reduce((s, a) => s + (isFinite(a.metrics.cpa) ? a.metrics.cpa : 0), 0) / withSpend.length;

  // Classify
  return enriched.map((ad) => {
    if (ad.metrics.spend === 0) return { ...ad, tier: 'E' };

    const r = ad.metrics.roas;
    const c = ad.metrics.cpa;

    let tier;
    if (r >= avgRoas * 1.5 && c <= avgCpa * 0.7) tier = 'A';
    else if (r >= avgRoas * 1.2 && c <= avgCpa * 0.9) tier = 'B';
    else if (r >= avgRoas * 0.8 && c <= avgCpa * 1.2) tier = 'C';
    else if (r >= avgRoas * 0.5) tier = 'D';
    else tier = 'E';

    return { ...ad, tier };
  });
}

/**
 * Get campaign-level results table.
 */
async function getCampaignResults(storeId, from, to) {
  const dateMatch = {};
  if (from) dateMatch.$gte = new Date(from);
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    dateMatch.$lte = toDate;
  }

  const insightMatch = {
    storeId: new mongoose.Types.ObjectId(storeId),
  };
  if (from || to) insightMatch.date = dateMatch;

  // Get campaign-level insights
  const campaigns = await MetaCampaign.find({
    storeId,
    level: 'campaign',
  }).lean();

  const insightsAgg = await MetaDailyInsight.aggregate([
    {
      $match: {
        ...insightMatch,
        metaId: { $in: campaigns.map((c) => c.metaId) },
      },
    },
    {
      $group: {
        _id: '$metaId',
        spend: { $sum: '$spend' },
        impressions: { $sum: '$impressions' },
        reach: { $sum: '$reach' },
        clicks: { $sum: '$clicks' },
        purchases: { $sum: '$purchases' },
        purchaseValue: { $sum: '$purchaseValue' },
      },
    },
  ]);

  const insightMap = {};
  for (const i of insightsAgg) insightMap[i._id] = i;

  return campaigns.map((c) => {
    const ins = insightMap[c.metaId] || { spend: 0, impressions: 0, reach: 0, clicks: 0, purchases: 0, purchaseValue: 0 };
    return {
      ...c,
      metrics: {
        ...ins,
        roas: ins.spend > 0 ? ins.purchaseValue / ins.spend : 0,
        cpa: ins.purchases > 0 ? ins.spend / ins.purchases : 0,
        ctr: ins.impressions > 0 ? (ins.clicks / ins.impressions) * 100 : 0,
      },
    };
  });
}

module.exports = {
  autoClassifyAds,
  getCampaignResults,
};
