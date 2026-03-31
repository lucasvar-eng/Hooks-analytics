const mongoose = require('mongoose');
const Store = require('../models/Store');
const MetaCampaign = require('../models/MetaCampaign');
const MetaDailyInsight = require('../models/MetaDailyInsight');
const metaAPI = require('../services/metaAPI');
const { syncMetaStructure, syncMetaInsights } = require('../services/syncMeta');
const { importMetaCSV, validateHeaders, getImportHistory } = require('../services/csvImportMeta');
const { classifyCampaign, getThresholds } = require('../services/verdictEngine');
const { meta: metaConfig } = require('../config/environment');
const logger = require('../utils/logger');

function getConfiguredMetaAccounts(store) {
  const configured = Array.isArray(store?.metaAdAccounts) ? store.metaAdAccounts.filter((item) => item?.id) : [];
  if (configured.length) return configured;
  if (store?.metaAdAccountId) return [{ id: store.metaAdAccountId, isPrimary: true }];
  return [];
}

function buildDateMatch(from, to) {
  if (!from || !to) return null;
  const start = new Date(from);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(23, 59, 59, 999);
  return { $gte: start, $lte: end };
}

function buildRangeOptions(from, to) {
  if (from && to) {
    return {
      dateFrom: String(from).slice(0, 10),
      dateTo: String(to).slice(0, 10),
    };
  }
  return { datePreset: 'last_30d' };
}

async function fetchLiveCampaignMetadata(store) {
  const token = store?.metaAccessToken;
  const accounts = getConfiguredMetaAccounts(store);
  if (!token || !accounts.length) return new Map();

  const responses = await Promise.allSettled(
    accounts.map((account) => metaAPI.getCampaigns(account.id, token))
  );

  const map = new Map();
  responses
    .filter((result) => result.status === 'fulfilled')
    .flatMap((result) => result.value || [])
    .forEach((campaign) => {
      map.set(campaign.id, {
        metaId: campaign.id,
        nombre: campaign.name || '',
        status: campaign.status || '',
        objective: campaign.objective || '',
        budget: parseFloat(campaign.daily_budget || campaign.lifetime_budget || 0) / 100 || 0,
        budgetType: campaign.daily_budget ? 'daily' : campaign.lifetime_budget ? 'lifetime' : '',
      });
    });

  return map;
}

async function aggregateInsightMap(storeId, metaIds, granularity, from, to) {
  if (!metaIds.length) return {};

  const storeObjectId = mongoose.Types.ObjectId.isValid(storeId)
    ? new mongoose.Types.ObjectId(storeId)
    : storeId;

  const match = {
    storeId: storeObjectId,
    metaId: { $in: metaIds },
    granularity,
  };

  const dateMatch = buildDateMatch(from, to);
  if (dateMatch) match.date = dateMatch;

  const rows = await MetaDailyInsight.aggregate([
    { $match: match },
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

  return rows.reduce((acc, row) => {
    acc[row._id] = row;
    return acc;
  }, {});
}

/**
 * Start Meta OAuth flow — return auth URL.
 */
exports.connect = async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const store = await Store.findById(storeId);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const redirectUri = metaConfig.callbackUrl || `${req.protocol}://${req.get('host')}/api/meta/callback`;
    const scopes = 'ads_read,business_management';

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

    const primaryAccount = adAccounts[0] || null;
    store.metaAccessToken = accessToken;
    store.metaTokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    store.metaAdAccountId = primaryAccount?.id || (primaryAccount?.account_id ? `act_${primaryAccount.account_id}` : '');
    store.metaAdAccounts = primaryAccount
      ? [{
          id: primaryAccount.id || (primaryAccount.account_id ? `act_${primaryAccount.account_id}` : ''),
          accountId: primaryAccount.account_id,
          name: primaryAccount.name,
          status: primaryAccount.account_status,
          currency: primaryAccount.currency,
          isPrimary: true,
          connectedAt: new Date(),
        }]
      : [];
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

    const [store, storedCampaigns] = await Promise.all([
      Store.findById(storeId).select('metaAccessToken metaAdAccountId metaAdAccounts').lean(),
      MetaCampaign.find({
        storeId,
        level: 'campaign',
      }).lean(),
    ]);

    const liveCampaignMap = await fetchLiveCampaignMetadata(store);
    const campaignIds = [...new Set([
      ...storedCampaigns.map((item) => item.metaId).filter(Boolean),
      ...Array.from(liveCampaignMap.keys()),
    ])];

    const insightMap = await aggregateInsightMap(storeId, campaignIds, 'campaign', from, to);
    const storedMap = new Map(storedCampaigns.map((item) => [item.metaId, item]));

    const result = campaignIds.map((metaId) => {
      const stored = storedMap.get(metaId) || {};
      const live = liveCampaignMap.get(metaId) || {};
      const i = insightMap[metaId] || {};

      return {
        ...stored,
        metaId,
        nombre: stored.nombre || live.nombre || `Campaña ${metaId}`,
        status: stored.status || live.status || 'ACTIVE',
        objective: stored.objective || live.objective || '',
        budget: stored.budget || live.budget || 0,
        budgetType: stored.budgetType || live.budgetType || '',
        metrics: {
          spend: i.spend || 0,
          impressions: i.impressions || 0,
          reach: i.reach || 0,
          clicks: i.clicks || 0,
          purchases: i.purchases || 0,
          revenue: i.purchaseValue || 0,
          purchaseValue: i.purchaseValue || 0,
          roas: i.spend > 0 ? (i.purchaseValue || 0) / i.spend : 0,
          cpa: i.purchases > 0 ? (i.spend || 0) / i.purchases : 0,
          cpc: i.clicks > 0 ? (i.spend || 0) / i.clicks : 0,
          ctr: i.impressions > 0 ? ((i.clicks || 0) / i.impressions) * 100 : 0,
        },
      };
    });

    // Add verdict to each campaign
    try {
      const thresholds = await getThresholds(storeId);
      const store = await Store.findById(storeId).select('objetivos').lean();
      for (const camp of result) {
        camp.metrics.verdict = classifyCampaign(camp.metrics, thresholds, store?.objetivos);
      }
    } catch (err) {
      logger.warn('Verdict classification skipped:', err.message);
    }

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

    const insightMap = await aggregateInsightMap(storeId, adsets.map((item) => item.metaId), 'adset', from, to);
    const result = adsets.map((adset) => {
      const i = insightMap[adset.metaId] || {};
      return {
        ...adset,
        nombre: adset.nombre || `Conjunto ${adset.metaId}`,
        status: adset.status || 'ACTIVE',
        metrics: {
          spend: i.spend || 0,
          impressions: i.impressions || 0,
          clicks: i.clicks || 0,
          purchases: i.purchases || 0,
          revenue: i.purchaseValue || 0,
          roas: i.spend > 0 ? (i.purchaseValue || 0) / i.spend : 0,
          cpa: i.purchases > 0 ? (i.spend || 0) / i.purchases : 0,
        },
      };
    });

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

    const insightMap = await aggregateInsightMap(storeId, ads.map((item) => item.metaId), 'ad', from, to);
    const result = ads.map((ad) => {
      const i = insightMap[ad.metaId] || {};
      return {
        ...ad,
        nombre: ad.nombre || ad.creativeName || `Anuncio ${ad.metaId}`,
        status: ad.status || 'ACTIVE',
        metrics: {
          spend: i.spend || 0,
          impressions: i.impressions || 0,
          clicks: i.clicks || 0,
          purchases: i.purchases || 0,
          revenue: i.purchaseValue || 0,
          roas: i.spend > 0 ? (i.purchaseValue || 0) / i.spend : 0,
          cpa: i.purchases > 0 ? (i.spend || 0) / i.purchases : 0,
        },
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Validate CSV headers without importing.
 */
exports.validateCSV = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const Papa = require('papaparse');
    const csvText = req.file.buffer.toString('utf-8');
    const parsed = Papa.parse(csvText, { skipEmptyLines: true });

    if (!parsed.data || parsed.data.length < 1) {
      return res.json({ isValid: false, detected: [], missing: ['CSV vacío'] });
    }

    const result = validateHeaders(parsed.data[0]);
    result.totalRows = parsed.data.length - 1;
    res.status(result.isValid ? 200 : 400).json(result);
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
    const headerCheck = validateHeaders(parsed.data?.[0] || []);

    if (!headerCheck.isValid) {
      return res.status(400).json({
        error: 'CSV inválido para importación',
        columnsDetected: headerCheck.detected,
        columnsMissing: headerCheck.missing,
      });
    }

    const result = await importMetaCSV(parsed.data, req.params.id, req.file.originalname, req.user?._id);

    res.json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get import history for a store.
 */
exports.getImportHistory = async (req, res, next) => {
  try {
    const history = await getImportHistory(req.params.id);
    res.json(history);
  } catch (error) {
    next(error);
  }
};
