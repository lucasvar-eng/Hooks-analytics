const mongoose = require('mongoose');
const Store = require('../models/Store');
const MetaCampaign = require('../models/MetaCampaign');
const MetaDailyInsight = require('../models/MetaDailyInsight');
const MetaProductInsight = require('../models/MetaProductInsight');
const metaAPI = require('../services/metaAPI');
const { syncMetaStructure, syncMetaInsights, syncMetaProductInsights } = require('../services/syncMeta');
const { importMetaCSV, validateHeaders, getImportHistory } = require('../services/csvImportMeta');
const { classifyCampaign, getThresholds } = require('../services/verdictEngine');
const { meta: metaConfig } = require('../config/environment');
const logger = require('../utils/logger');
const { buildBusinessDateKeyMatch } = require('../utils/businessDate');
const storeConnections = require('../services/storeConnections');

function getConfiguredMetaAccounts(store) {
  const configured = Array.isArray(store?.metaAdAccounts) ? store.metaAdAccounts.filter((item) => item?.id) : [];
  if (configured.length) return configured;
  if (store?.metaAdAccountId) return [{ id: store.metaAdAccountId, isPrimary: true }];
  return [];
}

function buildDateMatch(from, to) {
  if (!from || !to) return null;
  return buildBusinessDateKeyMatch(from, to, true);
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
  const token = await storeConnections.getToken(store?._id, 'meta');
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
        linkClicks: { $sum: '$linkClicks' },
        atc: { $sum: '$atc' },
        checkouts: { $sum: '$checkouts' },
        purchases: { $sum: '$purchases' },
        purchaseValue: { $sum: '$purchaseValue' },
        videoViews: { $sum: '$videoViews' },
        videoViewsPct25: { $sum: '$videoViewsPct25' },
        videoViewsPct50: { $sum: '$videoViewsPct50' },
        days: { $sum: 1 },
      },
    },
  ]);

  return rows.reduce((acc, row) => {
    const freq = row.reach > 0 ? row.impressions / row.reach : 0;
    acc[row._id] = { ...row, frequency: freq };
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

    const redirectUri = metaConfig.callbackUrl || `${req.protocol}://${req.get('host')}/api/callback`;
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

    const redirectUri = metaConfig.callbackUrl || `${req.protocol}://${req.get('host')}/api/callback`;
    const { accessToken, expiresIn } = await metaAPI.exchangeToken(code, redirectUri);

    // Get ad accounts to find the right one
    const adAccounts = await metaAPI.getAdAccounts(accessToken);

    const store = await Store.findById(storeId);
    if (!store) return res.redirect('/?error=store_not_found');

    const primaryAccount = adAccounts[0] || null;
    const primaryAccountId = primaryAccount?.id || (primaryAccount?.account_id ? `act_${primaryAccount.account_id}` : '');
    const adAccountsList = primaryAccount
      ? [{
          id: primaryAccountId,
          accountId: primaryAccount.account_id,
          name: primaryAccount.name,
          status: primaryAccount.account_status,
          currency: primaryAccount.currency,
          isPrimary: true,
          connectedAt: new Date(),
        }]
      : [];

    store.metaTokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    store.metaAdAccountId = primaryAccountId;
    store.metaAdAccounts = adAccountsList;
    store.integrationStatus.metaAds.connected = true;
    await store.save();

    await storeConnections.setConnection(storeId, 'meta', {
      accessToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      metadata: { adAccountId: primaryAccountId, adAccounts: adAccountsList },
      connectedByUser: req.user?._id,
    });

    logger.info(`Meta OAuth complete for ${store.nombre}, ad account: ${store.metaAdAccountId}`);

    // Trigger initial sync in background
    syncMetaStructure(store).then(() => syncMetaInsights(store, 30)).catch((err) => {
      logger.error(`Initial Meta sync failed: ${err.message}`);
    });

    res.redirect(`/store/${storeId}/settings?meta_connected=true`);
  } catch (error) {
    logger.error(`Meta OAuth callback error: ${error.message}`);
    const storeId = req.query.state;
    const target = storeId ? `/store/${storeId}/settings?error=meta_oauth_failed` : '/?error=meta_oauth_failed';
    res.redirect(target);
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
      Store.findById(storeId).select('metaAdAccountId metaAdAccounts').lean(),
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
          linkClicks: i.linkClicks || 0,
          atc: i.atc || 0,
          checkouts: i.checkouts || 0,
          purchases: i.purchases || 0,
          revenue: i.purchaseValue || 0,
          purchaseValue: i.purchaseValue || 0,
          roas: i.spend > 0 ? (i.purchaseValue || 0) / i.spend : 0,
          cpa: i.purchases > 0 ? (i.spend || 0) / i.purchases : 0,
          cpc: i.clicks > 0 ? (i.spend || 0) / i.clicks : 0,
          ctr: i.impressions > 0 ? ((i.clicks || 0) / i.impressions) * 100 : 0,
          // Frecuencia: impresiones / alcance. >2.5 ≈ creativo quemado / fatiga.
          frequency: i.frequency || 0,
          // Hook Rate aproximado: % de impresiones que generaron al menos un view.
          // Real "thumbstop ratio" requiere 3-sec views; usamos videoViews como proxy.
          videoViews: i.videoViews || 0,
          videoViewsPct25: i.videoViewsPct25 || 0,
          videoViewsPct50: i.videoViewsPct50 || 0,
          hookRate: i.impressions > 0 && i.videoViews > 0
            ? (i.videoViews / i.impressions) * 100
            : 0,
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

/**
 * Get spend-per-product breakdown for a store.
 * Aggregates MetaProductInsight rows in the date range.
 * Query params:
 *   from, to (YYYY-MM-DD)        — optional, defaults to last 30 days
 *   sortBy (spend|impressions|clicks|name)  — default spend
 *   limit (number, max 500)      — default 200
 *   minSpend (number)            — filter, default 0
 *   adId                         — optional, filter to a single ad
 */
exports.getProductInsights = async (req, res, next) => {
  try {
    const storeId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ error: 'invalid store id' });
    }

    const sortBy = ['spend', 'impressions', 'clicks', 'name'].includes(req.query.sortBy)
      ? req.query.sortBy : 'spend';
    const limit = Math.min(parseInt(req.query.limit || '200', 10) || 200, 500);
    const minSpend = parseFloat(req.query.minSpend || '0') || 0;

    const match = { storeId: new mongoose.Types.ObjectId(storeId) };
    const dateMatch = buildDateMatch(req.query.from, req.query.to);
    if (dateMatch) match.date = dateMatch;
    if (req.query.adId) match.adId = String(req.query.adId);

    const sortStage = sortBy === 'name'
      ? { productName: 1 }
      : { [sortBy === 'impressions' ? 'impressions' : sortBy === 'clicks' ? 'clicks' : 'spend']: -1 };

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: { metaProductId: '$metaProductId', productName: '$productName' },
          spend: { $sum: '$spend' },
          impressions: { $sum: '$impressions' },
          clicks: { $sum: '$clicks' },
          linkClicks: { $sum: '$linkClicks' },
          reach: { $max: '$reach' },
          purchases: { $sum: '$purchases' },
          purchaseValue: { $sum: '$purchaseValue' },
          atc: { $sum: '$atc' },
          tnProductId: { $first: '$tnProductId' },
          adsCount: { $addToSet: '$adId' },
        },
      },
      {
        $project: {
          _id: 0,
          metaProductId: '$_id.metaProductId',
          productName: '$_id.productName',
          spend: 1,
          impressions: 1,
          clicks: 1,
          linkClicks: 1,
          reach: 1,
          purchases: 1,
          purchaseValue: 1,
          atc: 1,
          tnProductId: 1,
          adsCount: { $size: '$adsCount' },
        },
      },
      { $match: { spend: { $gte: minSpend } } },
      { $sort: sortStage },
      { $limit: limit },
    ];

    const rows = await MetaProductInsight.aggregate(pipeline);

    // Totals (independent of limit) — useful for the frontend top banner.
    const totalsAgg = await MetaProductInsight.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalSpend: { $sum: '$spend' },
          totalImpressions: { $sum: '$impressions' },
          totalClicks: { $sum: '$clicks' },
          productCount: { $addToSet: '$metaProductId' },
        },
      },
      { $project: { _id: 0, totalSpend: 1, totalImpressions: 1, totalClicks: 1, productCount: { $size: '$productCount' } } },
    ]);
    const totals = totalsAgg[0] || { totalSpend: 0, totalImpressions: 0, totalClicks: 0, productCount: 0 };

    res.json({ totals, rows, sortBy, limit, minSpend });
  } catch (error) {
    next(error);
  }
};

/**
 * Manual trigger for product breakdown sync. Useful for the first backfill
 * or to validate the sync end-to-end before relying on the cron.
 * Body: { daysBack?: number }
 */
exports.syncProductInsights = async (req, res, next) => {
  try {
    const storeId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ error: 'invalid store id' });
    }

    const store = await Store.findById(storeId);
    if (!store) return res.status(404).json({ error: 'store not found' });
    const metaToken = await storeConnections.getToken(storeId, 'meta');
    if (!metaToken) {
      return res.status(400).json({ error: 'store does not have a Meta access token' });
    }

    const daysBack = Math.min(parseInt(req.body?.daysBack || '7', 10) || 7, 90);
    await syncMetaProductInsights(store, daysBack);

    res.json({ ok: true, daysBack });
  } catch (error) {
    logger.error(`Manual product insights sync failed: ${error.message}`);
    next(error);
  }
};

/**
 * Endpoint consolidado para la página Meta Ads:
 *  - totals: suma del período (todas las cuentas, granularidad campaign)
 *  - funnel: pasos del embudo (impressions → reach → linkClicks → atc → checkouts → purchases)
 *  - daily: array por día con spend, purchaseValue, purchases (para chart diario)
 */
exports.getOverview = async (req, res, next) => {
  try {
    const { id: storeId } = req.params;
    const { from, to } = req.query;
    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(400).json({ error: 'invalid store id' });
    }

    const storeObjectId = new mongoose.Types.ObjectId(storeId);
    const match = { storeId: storeObjectId, granularity: 'campaign' };
    const dateMatch = buildDateMatch(from, to);
    if (dateMatch) match.date = dateMatch;

    const [totalsAgg, dailyAgg] = await Promise.all([
      MetaDailyInsight.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            spend: { $sum: '$spend' },
            impressions: { $sum: '$impressions' },
            reach: { $sum: '$reach' },
            clicks: { $sum: '$clicks' },
            linkClicks: { $sum: '$linkClicks' },
            atc: { $sum: '$atc' },
            checkouts: { $sum: '$checkouts' },
            purchases: { $sum: '$purchases' },
            purchaseValue: { $sum: '$purchaseValue' },
          },
        },
      ]),
      MetaDailyInsight.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            spend: { $sum: '$spend' },
            purchaseValue: { $sum: '$purchaseValue' },
            purchases: { $sum: '$purchases' },
            clicks: { $sum: '$clicks' },
            atc: { $sum: '$atc' },
            checkouts: { $sum: '$checkouts' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const t = totalsAgg[0] || {};
    const totals = {
      spend: t.spend || 0,
      impressions: t.impressions || 0,
      reach: t.reach || 0,
      clicks: t.clicks || 0,
      linkClicks: t.linkClicks || 0,
      atc: t.atc || 0,
      checkouts: t.checkouts || 0,
      purchases: t.purchases || 0,
      purchaseValue: t.purchaseValue || 0,
      roas: t.spend > 0 ? (t.purchaseValue || 0) / t.spend : 0,
      cpa: t.purchases > 0 ? (t.spend || 0) / t.purchases : 0,
      cpc: t.linkClicks > 0 ? (t.spend || 0) / t.linkClicks : 0,
      cpm: t.impressions > 0 ? ((t.spend || 0) / t.impressions) * 1000 : 0,
      ctr: t.impressions > 0 ? ((t.clicks || 0) / t.impressions) * 100 : 0,
    };

    // Funnel ordenado descendente — sólo pasos con acción real del usuario
    // (impresiones es exposición, no acción → queda fuera del funnel pero sigue
    // disponible en totals para CTR y métricas técnicas)
    const linkClicks = totals.linkClicks || totals.clicks || 0;
    const funnel = [
      { key: 'reach', label: 'Alcance', value: totals.reach, parent: null },
      { key: 'clicks', label: 'Clicks al link', value: linkClicks, parent: 'reach' },
      { key: 'atc', label: 'Add to cart', value: totals.atc, parent: 'clicks' },
      { key: 'checkouts', label: 'Checkout iniciado', value: totals.checkouts, parent: 'atc' },
      { key: 'purchases', label: 'Compras', value: totals.purchases, parent: 'checkouts' },
    ].map((step, idx, arr) => {
      const parent = step.parent ? arr.find((s) => s.key === step.parent) : null;
      const conversionPct = parent && parent.value > 0
        ? (step.value / parent.value) * 100
        : null;
      const topValue = arr[0]?.value || 0;
      const sharePct = topValue > 0 && idx > 0
        ? (step.value / topValue) * 100
        : null;
      return { ...step, conversionPct, sharePct };
    });

    res.json({ totals, funnel, daily: dailyAgg });
  } catch (error) {
    next(error);
  }
};
