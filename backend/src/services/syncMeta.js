const metaAPI = require('./metaAPI');
const MetaCampaign = require('../models/MetaCampaign');
const MetaDailyInsight = require('../models/MetaDailyInsight');
const MetaProductInsight = require('../models/MetaProductInsight');
const Product = require('../models/Product');
const SyncLog = require('../models/SyncLog');
const { recalculateDailyMetric } = require('./metricCalculator');
const { toBusinessDateLabel, addDaysToLabel } = require('../utils/businessDate');
const storeConnections = require('./storeConnections');
const logger = require('../utils/logger');

function normalizeProductName(name) {
  return String(name || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getConfiguredMetaAccounts(store) {
  const configured = Array.isArray(store.metaAdAccounts) ? store.metaAdAccounts.filter((item) => item?.id) : [];
  if (configured.length) {
    const primary = configured.find((item) => item.isPrimary) || configured[0];
    return [
      primary,
      ...configured.filter((item) => item.id !== primary.id),
    ];
  }

  if (store.metaAdAccountId) {
    return [{ id: store.metaAdAccountId, isPrimary: true }];
  }

  return [];
}

function mapInsightRow(granularity, row, adAccountId) {
  const metaId =
    granularity === 'campaign'
      ? row.campaign_id
      : granularity === 'adset'
        ? row.adset_id
        : row.ad_id;

  if (!metaId) return null;

  const date = new Date(row.date_start);
  date.setUTCHours(0, 0, 0, 0);

  return {
    metaId,
    date,
    adAccountId,
    source: 'api',
    granularity,
    spend: parseFloat(row.spend || 0),
    impressions: parseInt(row.impressions || 0, 10),
    reach: parseInt(row.reach || 0, 10),
    frequency: parseFloat(row.frequency || 0),
    clicks: parseInt(row.clicks || 0, 10),
    uniqueClicks: parseInt(row.unique_clicks || 0, 10),
    linkClicks: parseInt(row.inline_link_clicks || 0, 10),
    cpm: parseFloat(row.cpm || 0),
    cpc: parseFloat(row.cpc || 0),
    ctr: parseFloat(row.ctr || 0),
    purchases: metaAPI.parseActions(row.actions, 'purchase'),
    purchaseValue: metaAPI.parseActionValues(row.action_values, 'purchase'),
    costPerPurchase: metaAPI.parseActions(row.cost_per_action_type, 'purchase'),
    atc: metaAPI.parseActions(row.actions, 'add_to_cart'),
    checkouts: metaAPI.parseActions(row.actions, 'initiate_checkout'),
    leads: metaAPI.parseActions(row.actions, 'lead'),
    videoViews: metaAPI.parseActions(row.actions, 'video_view'),
    thruPlays: parseInt(row.video_thruplay_watched_actions?.[0]?.value || 0, 10),
  };
}

async function upsertInsightRows(store, rows, granularity, adAccountId, affectedDates) {
  let total = 0;

  for (const row of rows || []) {
    const payload = mapInsightRow(granularity, row, adAccountId);
    if (!payload) continue;

    await MetaDailyInsight.findOneAndUpdate(
      {
        storeId: store._id,
        metaId: payload.metaId,
        date: payload.date,
        source: 'api',
        granularity,
      },
      payload,
      { upsert: true }
    );

    affectedDates.add(row.date_start);
    total++;
  }

  return total;
}

/**
 * Sync campaign/adset/ad structure from Meta.
 */
async function syncMetaStructure(store) {
  const startTime = Date.now();
  const log = await SyncLog.create({
    storeId: store._id,
    type: 'meta_structure',
    status: 'running',
  });

  try {
    const token = await storeConnections.getToken(store._id, 'meta');
    const adAccounts = getConfiguredMetaAccounts(store);
    let totalRecords = 0;

    for (const adAccount of adAccounts) {
      const adAccountId = adAccount.id;

      // 1. Campaigns
      const campaigns = await metaAPI.getCampaigns(adAccountId, token);
      for (const c of campaigns) {
        await MetaCampaign.findOneAndUpdate(
          { storeId: store._id, metaId: c.id },
          {
            adAccountId,
            nombre: c.name,
            status: c.status,
            level: 'campaign',
            objective: c.objective,
            budget: parseFloat(c.daily_budget || c.lifetime_budget || 0) / 100,
            budgetType: c.daily_budget ? 'daily' : 'lifetime',
          },
          { upsert: true }
        );
        totalRecords++;
      }

      await sleep(500);

      // 2. AdSets for the whole ad account
      const adsets = await metaAPI.getAccountAdSets(adAccountId, token);
      for (const as of adsets) {
        await MetaCampaign.findOneAndUpdate(
          { storeId: store._id, metaId: as.id },
          {
            adAccountId,
            nombre: as.name,
            status: as.status,
            level: 'adset',
            parentId: as.campaign_id,
            budget: parseFloat(as.daily_budget || as.lifetime_budget || 0) / 100,
            budgetType: as.daily_budget ? 'daily' : 'lifetime',
          },
          { upsert: true }
        );
        totalRecords++;
      }

      await sleep(500);

      // 3. Ads for the whole ad account
      const ads = await metaAPI.getAccountAds(adAccountId, token);
      for (const ad of ads) {
        await MetaCampaign.findOneAndUpdate(
          { storeId: store._id, metaId: ad.id },
          {
            adAccountId,
            nombre: ad.name,
            status: ad.status,
            level: 'ad',
            parentId: ad.adset_id,
            thumbnailUrl: ad.creative?.thumbnail_url,
            creativeName: ad.creative?.name,
            creativeBody: ad.creative?.body,
            creativeTitle: ad.creative?.title,
          },
          { upsert: true }
        );
        totalRecords++;
      }

      await sleep(500);
    }

    log.status = 'success';
    log.recordsFetched = totalRecords;
    log.duration = Date.now() - startTime;
    await log.save();

    logger.info(`Meta structure synced for ${store.nombre}: ${totalRecords} objects in ${log.duration}ms`);
  } catch (error) {
    log.status = 'error';
    log.error = error.message;
    log.duration = Date.now() - startTime;
    await log.save();
    logger.error(`Meta structure sync failed for ${store.nombre}: ${error.message}`);
    throw error;
  }
}

/**
 * Sync daily insights for all campaigns.
 * Last 7 days by default (covers any delayed reporting).
 */
async function syncMetaInsights(store, daysBack = 7) {
  const startTime = Date.now();
  const log = await SyncLog.create({
    storeId: store._id,
    type: 'meta_insights',
    status: 'running',
  });

  try {
    const token = await storeConnections.getToken(store._id, 'meta');
    const configuredAccounts = getConfiguredMetaAccounts(store);
    const todayLabel = toBusinessDateLabel(new Date());
    const fromStr = addDaysToLabel(todayLabel, -daysBack);
    const toStr = todayLabel;

    let totalRecords = 0;
    const affectedDates = new Set();

    for (const account of configuredAccounts) {
      const campaignRows = await metaAPI.getInsightsForAdAccount(account.id, token, {
        level: 'campaign',
        dateFrom: fromStr,
        dateTo: toStr,
      });
      totalRecords += await upsertInsightRows(store, campaignRows, 'campaign', account.id, affectedDates);

      await sleep(400);

      const adsetRows = await metaAPI.getInsightsForAdAccount(account.id, token, {
        level: 'adset',
        dateFrom: fromStr,
        dateTo: toStr,
      });
      totalRecords += await upsertInsightRows(store, adsetRows, 'adset', account.id, affectedDates);

      await sleep(400);

      const adRows = await metaAPI.getInsightsForAdAccount(account.id, token, {
        level: 'ad',
        dateFrom: fromStr,
        dateTo: toStr,
      });
      totalRecords += await upsertInsightRows(store, adRows, 'ad', account.id, affectedDates);

      await sleep(400);
    }

    // Recalculate DailyMetrics for affected dates
    for (const dateStr of affectedDates) {
      await recalculateDailyMetric(store._id, dateStr);
    }

    // Update last sync
    store.integrationStatus.metaAds.lastSync = new Date();
    await store.save();

    log.status = 'success';
    log.recordsFetched = totalRecords;
    log.duration = Date.now() - startTime;
    await log.save();

    logger.info(`Meta insights synced for ${store.nombre}: ${totalRecords} rows in ${log.duration}ms`);
  } catch (error) {
    log.status = 'error';
    log.error = error.message;
    log.duration = Date.now() - startTime;
    await log.save();
    logger.error(`Meta insights sync failed for ${store.nombre}: ${error.message}`);
    throw error;
  }
}

/**
 * Sync product_id breakdown insights for all active DPA/catalog ads.
 * Persists per (ad, product, date) so the frontend can show "spend per product".
 * Last `daysBack` days by default.
 */
async function syncMetaProductInsights(store, daysBack = 7) {
  const startTime = Date.now();
  const log = await SyncLog.create({
    storeId: store._id,
    type: 'meta_product_insights',
    status: 'running',
  });

  try {
    const token = await storeConnections.getToken(store._id, 'meta');
    const todayLabel = toBusinessDateLabel(new Date());
    const fromStr = addDaysToLabel(todayLabel, -daysBack);
    const toStr = todayLabel;

    // 1. Active ads to query. The breakdown only makes sense for ads that ran.
    //    We query at level=ad with breakdowns=product_id, one call per ad.
    const ads = await MetaCampaign.find(
      { storeId: store._id, level: 'ad', status: 'ACTIVE' },
      'metaId adAccountId parentId'
    ).lean();

    if (!ads.length) {
      log.status = 'success';
      log.recordsFetched = 0;
      log.duration = Date.now() - startTime;
      await log.save();
      logger.info(`Meta product breakdown: no active ads for ${store.nombre}`);
      return;
    }

    // 2. Build name → tnProductId map for best-effort product matching.
    const tnProducts = await Product.find(
      { storeId: store._id },
      'tnProductId nombre'
    ).lean();
    const nameToTnId = new Map();
    for (const p of tnProducts) {
      const key = normalizeProductName(p.nombre);
      if (key && !nameToTnId.has(key)) nameToTnId.set(key, String(p.tnProductId));
    }

    // 3. Build adset/campaign parent lookup for context columns.
    const adsetLookup = new Map();
    const adsets = await MetaCampaign.find(
      { storeId: store._id, level: 'adset' },
      'metaId parentId'
    ).lean();
    adsets.forEach(a => adsetLookup.set(String(a.metaId), String(a.parentId || '')));

    let totalRecords = 0;
    let totalRowsFetched = 0;

    for (const ad of ads) {
      try {
        const rows = await metaAPI.getProductBreakdownInsights(ad.metaId, token, {
          dateFrom: fromStr,
          dateTo: toStr,
        });
        totalRowsFetched += rows.length;

        // Note: breakdown=product_id collapses the time range into a single bucket per product
        // unless time_increment=1 is added. We respect that — we keep one row per (ad, product, window)
        // with date = dateTo. Adding time_increment=1 would multiply rows by ~daysBack and the endpoint
        // becomes slow / hit rate limits. The DailyMetric layer keeps the day-level accuracy elsewhere.
        const reportingDate = new Date(toStr);
        reportingDate.setUTCHours(0, 0, 0, 0);

        const campaignId = adsetLookup.get(String(ad.parentId || '')) || null;

        for (const row of rows) {
          const raw = row.product_id || '';
          const match = String(raw).match(/^(\d+)\s*,\s*(.+)$/);
          const metaProductId = match ? match[1] : String(raw);
          const productName = match ? match[2].trim() : '';
          const tnProductId = nameToTnId.get(normalizeProductName(productName)) || null;

          const payload = {
            adAccountId: ad.adAccountId || null,
            adId: ad.metaId,
            adsetId: ad.parentId || null,
            campaignId,
            productName,
            tnProductId,
            spend: parseFloat(row.spend || 0),
            impressions: parseInt(row.impressions || 0, 10),
            clicks: parseInt(row.clicks || 0, 10),
            linkClicks: parseInt(row.inline_link_clicks || 0, 10),
            reach: parseInt(row.reach || 0, 10),
            purchases: metaAPI.parseActions(row.actions, 'purchase'),
            purchaseValue: metaAPI.parseActionValues(row.action_values, 'purchase'),
            atc: metaAPI.parseActions(row.actions, 'add_to_cart'),
            checkouts: metaAPI.parseActions(row.actions, 'initiate_checkout'),
          };

          await MetaProductInsight.findOneAndUpdate(
            {
              storeId: store._id,
              adId: ad.metaId,
              metaProductId,
              date: reportingDate,
              source: 'api',
            },
            payload,
            { upsert: true }
          );
          totalRecords++;
        }

        await sleep(350);
      } catch (error) {
        logger.warn(`Meta product breakdown failed for ad ${ad.metaId} (${store.nombre}): ${error.message}`);
      }
    }

    log.status = 'success';
    log.recordsFetched = totalRecords;
    log.duration = Date.now() - startTime;
    await log.save();

    logger.info(`Meta product breakdown synced for ${store.nombre}: ${totalRecords} rows from ${totalRowsFetched} API rows across ${ads.length} ads in ${log.duration}ms`);
  } catch (error) {
    log.status = 'error';
    log.error = error.message;
    log.duration = Date.now() - startTime;
    await log.save();
    logger.error(`Meta product breakdown sync failed for ${store.nombre}: ${error.message}`);
    throw error;
  }
}

/**
 * Refresh Meta token if it's expiring within 7 days.
 */
async function refreshMetaTokens(store) {
  const conn = await storeConnections.getConnection(store._id, 'meta');
  if (!conn || !conn.expiresAt) return;

  const daysUntilExpiry = (conn.expiresAt - new Date()) / (1000 * 60 * 60 * 24);
  if (daysUntilExpiry >= 7) return;

  try {
    // Tomamos el token actual descifrado para llamar a la API
    const currentToken = await storeConnections.getToken(store._id, 'meta');
    const { accessToken, expiresIn } = await metaAPI.refreshLongLivedToken(currentToken);
    await storeConnections.setConnection(store._id, 'meta', {
      accessToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      metadata: conn.metadata,
    });
    logger.info(`Meta token refreshed for ${store.nombre} (expires in ${Math.round(expiresIn / 86400)} days)`);
  } catch (error) {
    logger.error(`Meta token refresh failed for ${store.nombre}: ${error.message}`);
    await storeConnections.markError(store._id, 'meta', error.message);
  }
}

module.exports = { syncMetaStructure, syncMetaInsights, syncMetaProductInsights, refreshMetaTokens };
