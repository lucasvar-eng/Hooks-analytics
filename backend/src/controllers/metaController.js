const Store = require('../models/Store');
const MetaCampaign = require('../models/MetaCampaign');
const MetaDailyInsight = require('../models/MetaDailyInsight');
const metaAPI = require('../services/metaAPI');
const { syncMetaStructure, syncMetaInsights } = require('../services/syncMeta');
const { importMetaCSV } = require('../services/csvImportMeta');
const { meta: metaConfig } = require('../config/environment');
const logger = require('../utils/logger');

/**
 * Start Meta OAuth flow — return auth URL.
 */
exports.connect = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const store = await Store.findById(storeId);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const redirectUri = metaConfig.callbackUrl || `${req.protocol}://${req.get('host')}/api/meta/callback`;
    const scopes = 'ads_read,ads_management,pages_read_engagement';

    const authUrl =
      `https://www.facebook.com/v19.0/dialog/oauth` +
      `?client_id=${metaConfig.appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${scopes}` +
      `&state=${storeId}` +
      `&response_type=code`;

    res.json({ authUrl });
  } catch (error) {
    next(error);
  }
};

/**
 * Meta OAuth callback — exchange code for token.
 */
exports.callback = async (req, res, next) => {
  try {
    const { code, state: storeId } = req.query;

    if (!code) return res.redirect('/?error=meta_no_code');

    const redirectUri = metaConfig.callbackUrl || `${req.protocol}://${req.get('host')}/api/meta/callback`;
    const { accessToken, expiresIn } = await metaAPI.exchangeToken(code, redirectUri);

    // Get ad accounts to find the right one
    const adAccounts = await metaAPI.getAdAccounts(accessToken);

    const store = await Store.findById(storeId);
    if (!store) return res.redirect('/?error=store_not_found');

    store.metaAccessToken = accessToken;
    store.metaTokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    store.metaAdAccountId = adAccounts[0]?.account_id || '';
    store.integrationStatus.metaAds.connected = true;
    await store.save();

    logger.info(`Meta OAuth complete for ${store.nombre}, ad account: ${store.metaAdAccountId}`);

    // Trigger initial sync in background
    syncMetaStructure(store).then(() => syncMetaInsights(store, 30)).catch((err) => {
      logger.error(`Initial Meta sync failed: ${err.message}`);
    });

    res.redirect(`/store/${storeId}?meta_connected=true`);
  } catch (error) {
    logger.error(`Meta OAuth callback error: ${error.message}`);
    res.redirect('/?error=meta_oauth_failed');
  }
};

/**
 * List campaigns with aggregated metrics for date range.
 */
exports.getCampaigns = async (req, res, next) => {
  try {
    const { id: storeId } = req.params;
    const { from, to } = req.query;

    const campaigns = await MetaCampaign.find({
      storeId,
      level: 'campaign',
    }).lean();

    // Aggregate insights per campaign
    const result = await Promise.all(
      campaigns.map(async (c) => {
        const insights = await MetaDailyInsight.aggregate([
          {
            $match: {
              storeId: c.storeId,
              metaId: c.metaId,
              ...(from && to
                ? { date: { $gte: new Date(from), $lte: new Date(to) } }
                : {}),
            },
          },
          {
            $group: {
              _id: null,
              spend: { $sum: '$spend' },
              impressions: { $sum: '$impressions' },
              reach: { $sum: '$reach' },
              clicks: { $sum: '$clicks' },
              purchases: { $sum: '$purchases' },
              purchaseValue: { $sum: '$purchaseValue' },
            },
          },
        ]);

        const i = insights[0] || {};
        return {
          ...c,
          metrics: {
            spend: i.spend || 0,
            impressions: i.impressions || 0,
            reach: i.reach || 0,
            clicks: i.clicks || 0,
            purchases: i.purchases || 0,
            revenue: i.purchaseValue || 0,
            roas: i.spend > 0 ? (i.purchaseValue || 0) / i.spend : 0,
            cpa: i.purchases > 0 ? (i.spend || 0) / i.purchases : 0,
            cpc: i.clicks > 0 ? (i.spend || 0) / i.clicks : 0,
            ctr: i.impressions > 0 ? ((i.clicks || 0) / i.impressions) * 100 : 0,
          },
        };
      })
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get ad sets for a campaign.
 */
exports.getAdSets = async (req, res, next) => {
  try {
    const { id: storeId, campaignId } = req.params;
    const { from, to } = req.query;

    const campaign = await MetaCampaign.findOne({ storeId, metaId: campaignId });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const adsets = await MetaCampaign.find({
      storeId,
      level: 'adset',
      parentId: campaignId,
    }).lean();

    const result = await Promise.all(
      adsets.map(async (as) => {
        const insights = await MetaDailyInsight.aggregate([
          {
            $match: {
              storeId: as.storeId,
              metaId: as.metaId,
              ...(from && to
                ? { date: { $gte: new Date(from), $lte: new Date(to) } }
                : {}),
            },
          },
          {
            $group: {
              _id: null,
              spend: { $sum: '$spend' },
              impressions: { $sum: '$impressions' },
              clicks: { $sum: '$clicks' },
              purchases: { $sum: '$purchases' },
              purchaseValue: { $sum: '$purchaseValue' },
            },
          },
        ]);
        const i = insights[0] || {};
        return {
          ...as,
          metrics: {
            spend: i.spend || 0,
            purchases: i.purchases || 0,
            revenue: i.purchaseValue || 0,
            roas: i.spend > 0 ? (i.purchaseValue || 0) / i.spend : 0,
            cpa: i.purchases > 0 ? (i.spend || 0) / i.purchases : 0,
          },
        };
      })
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get ads for an ad set.
 */
exports.getAds = async (req, res, next) => {
  try {
    const { id: storeId, adsetId } = req.params;
    const { from, to } = req.query;

    const ads = await MetaCampaign.find({
      storeId,
      level: 'ad',
      parentId: adsetId,
    }).lean();

    const result = await Promise.all(
      ads.map(async (ad) => {
        const insights = await MetaDailyInsight.aggregate([
          {
            $match: {
              storeId: ad.storeId,
              metaId: ad.metaId,
              ...(from && to
                ? { date: { $gte: new Date(from), $lte: new Date(to) } }
                : {}),
            },
          },
          {
            $group: {
              _id: null,
              spend: { $sum: '$spend' },
              impressions: { $sum: '$impressions' },
              clicks: { $sum: '$clicks' },
              purchases: { $sum: '$purchases' },
              purchaseValue: { $sum: '$purchaseValue' },
            },
          },
        ]);
        const i = insights[0] || {};
        return {
          ...ad,
          metrics: {
            spend: i.spend || 0,
            purchases: i.purchases || 0,
            revenue: i.purchaseValue || 0,
            roas: i.spend > 0 ? (i.purchaseValue || 0) / i.spend : 0,
            cpa: i.purchases > 0 ? (i.spend || 0) / i.purchases : 0,
          },
        };
      })
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Import Meta Ads data from CSV upload.
 */
exports.importCSV = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const Papa = require('papaparse');
    const csvText = req.file.buffer.toString('utf-8');
    const parsed = Papa.parse(csvText, { skipEmptyLines: true });

    const { imported, errors } = await importMetaCSV(parsed.data, req.params.id);

    res.json({ imported, errors: errors.slice(0, 10) });
  } catch (error) {
    next(error);
  }
};
