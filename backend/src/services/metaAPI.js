const axios = require('axios');
const logger = require('../utils/logger');

const GRAPH_API = 'https://graph.facebook.com/v23.0';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeAdAccountId(adAccountId) {
  if (!adAccountId) return '';
  const raw = String(adAccountId).trim();
  return raw.startsWith('act_') ? raw : `act_${raw}`;
}

function isRetryableMetaError(error) {
  const status = error.response?.status;
  const code = error.response?.data?.error?.code;
  return status === 429 || code === 17;
}

async function getWithRetry(url, params, contextLabel) {
  let retries = 0;
  const maxRetries = 5;

  while (retries <= maxRetries) {
    try {
      const res = await axios.get(url, { params });
      return res.data.data || res.data;
    } catch (error) {
      if (!isRetryableMetaError(error) || retries >= maxRetries) {
        throw error;
      }

      const waitTime = Math.pow(2, retries + 1) * 1500;
      logger.warn(`Meta rate limit on ${contextLabel}, waiting ${waitTime}ms (retry ${retries + 1}/${maxRetries})`);
      await sleep(waitTime);
      retries++;
    }
  }
}

/**
 * Exchange short-lived code for long-lived token (60 days).
 */
async function exchangeToken(code, redirectUri) {
  const { meta } = require('../config/environment');

  // Step 1: Exchange code for short-lived token
  const shortRes = await axios.get(`${GRAPH_API}/oauth/access_token`, {
    params: {
      client_id: meta.appId,
      client_secret: meta.appSecret,
      redirect_uri: redirectUri,
      code,
    },
  });

  const shortToken = shortRes.data.access_token;

  // Step 2: Exchange short-lived for long-lived token
  const longRes = await axios.get(`${GRAPH_API}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: meta.appId,
      client_secret: meta.appSecret,
      fb_exchange_token: shortToken,
    },
  });

  return {
    accessToken: longRes.data.access_token,
    expiresIn: longRes.data.expires_in, // seconds (~60 days)
  };
}

/**
 * Refresh a long-lived token (extends another 60 days).
 */
async function refreshLongLivedToken(token) {
  const { meta } = require('../config/environment');

  const res = await axios.get(`${GRAPH_API}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: meta.appId,
      client_secret: meta.appSecret,
      fb_exchange_token: token,
    },
  });

  return {
    accessToken: res.data.access_token,
    expiresIn: res.data.expires_in,
  };
}

/**
 * Get ad accounts for a user.
 */
async function getAdAccounts(token) {
  return getWithRetry(
    `${GRAPH_API}/me/adaccounts`,
    {
      access_token: token,
      fields: 'id,name,account_id,account_status,currency',
      limit: 50,
    },
    'me/adaccounts'
  );
}

/**
 * Get campaigns for an ad account.
 */
async function getCampaigns(adAccountId, token) {
  return getWithRetry(
    `${GRAPH_API}/${normalizeAdAccountId(adAccountId)}/campaigns`,
    {
      access_token: token,
      fields: 'id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time',
      limit: 500,
    },
    `campaigns:${normalizeAdAccountId(adAccountId)}`
  );
}

/**
 * Get ad sets for a campaign.
 */
async function getAdSets(campaignId, token) {
  return getWithRetry(
    `${GRAPH_API}/${campaignId}/adsets`,
    {
      access_token: token,
      fields: 'id,name,status,daily_budget,lifetime_budget,targeting,optimization_goal',
      limit: 500,
    },
    `adsets:${campaignId}`
  );
}

async function getAccountAdSets(adAccountId, token) {
  return getWithRetry(
    `${GRAPH_API}/${normalizeAdAccountId(adAccountId)}/adsets`,
    {
      access_token: token,
      fields: 'id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,optimization_goal',
      limit: 500,
    },
    `account-adsets:${normalizeAdAccountId(adAccountId)}`
  );
}

/**
 * Get ads for an ad set.
 */
async function getAds(adSetId, token) {
  return getWithRetry(
    `${GRAPH_API}/${adSetId}/ads`,
    {
      access_token: token,
      fields: 'id,name,status,creative{id,name,body,title,thumbnail_url}',
      limit: 500,
    },
    `ads:${adSetId}`
  );
}

async function getAccountAds(adAccountId, token) {
  return getWithRetry(
    `${GRAPH_API}/${normalizeAdAccountId(adAccountId)}/ads`,
    {
      access_token: token,
      fields: 'id,name,status,adset_id,campaign_id,creative{id,name,body,title,thumbnail_url}',
      limit: 500,
    },
    `account-ads:${normalizeAdAccountId(adAccountId)}`
  );
}

/**
 * Get insights for an object (campaign/adset/ad) over a date range.
 * Includes retry with backoff for rate limiting.
 */
async function getInsights(objectId, dateFrom, dateTo, token, breakdowns = []) {
  const params = {
    access_token: token,
    fields: [
      'spend', 'impressions', 'reach', 'frequency',
      'clicks', 'unique_clicks', 'inline_link_clicks',
      'cpm', 'cpc', 'ctr',
      'actions', 'action_values', 'cost_per_action_type',
      'video_p25_watched_actions', 'video_p50_watched_actions',
      'video_p75_watched_actions', 'video_p100_watched_actions',
      'video_thruplay_watched_actions',
    ].join(','),
    time_range: JSON.stringify({
      since: dateFrom,
      until: dateTo,
    }),
    time_increment: 1, // daily granularity
    limit: 500,
  };

  if (breakdowns.length > 0) {
    params.breakdowns = breakdowns.join(',');
  }

  let retries = 0;
  const maxRetries = 3;

  while (retries <= maxRetries) {
    try {
      const res = await axios.get(`${GRAPH_API}/${objectId}/insights`, { params });
      return res.data.data || [];
    } catch (error) {
      if (isRetryableMetaError(error) && retries < maxRetries) {
        const waitTime = Math.pow(2, retries + 1) * 1000;
        logger.warn(`Meta rate limit, waiting ${waitTime}ms (retry ${retries + 1}/${maxRetries})`);
        await sleep(waitTime);
        retries++;
      } else {
        throw error;
      }
    }
  }
}

/**
 * Get product_id breakdown insights for a single ad (DPA / catalog ads).
 * Paginated automatically via paging.next.
 * Returns an array of rows with shape { product_id, spend, impressions, clicks, actions, action_values, date_start }.
 */
async function getProductBreakdownInsights(adId, token, { dateFrom, dateTo, fields, limit = 500 } = {}) {
  const queryFields = (fields && fields.length ? fields : [
    'spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks',
    'actions', 'action_values',
  ]).join(',');

  const params = {
    access_token: token,
    fields: queryFields,
    breakdowns: 'product_id',
    limit,
  };

  if (dateFrom && dateTo) {
    params.time_range = JSON.stringify({ since: dateFrom, until: dateTo });
  }

  const rows = [];
  let url = `${GRAPH_API}/${adId}/insights`;
  let currentParams = params;
  let safetyCount = 0;
  const safetyMax = 50; // hard ceiling against runaway pagination

  while (url && safetyCount < safetyMax) {
    let retries = 0;
    const maxRetries = 5;
    let pageResp = null;

    while (retries <= maxRetries) {
      try {
        const res = await axios.get(url, { params: currentParams });
        pageResp = res.data;
        break;
      } catch (error) {
        if (!isRetryableMetaError(error) || retries >= maxRetries) throw error;
        const waitTime = Math.pow(2, retries + 1) * 1500;
        logger.warn(`Meta rate limit on product breakdown ad ${adId}, waiting ${waitTime}ms (retry ${retries + 1}/${maxRetries})`);
        await sleep(waitTime);
        retries++;
      }
    }

    if (!pageResp) break;
    if (Array.isArray(pageResp.data)) rows.push(...pageResp.data);

    const next = pageResp.paging?.next;
    if (!next) break;
    url = next;
    currentParams = undefined; // next URL already contains params
    safetyCount++;
  }

  return rows;
}

async function getInsightsForAdAccount(adAccountId, token, options = {}) {
  const {
    level = 'ad',
    timeIncrement = 1,
    datePreset,
    dateFrom,
    dateTo,
    fields = [
      'campaign_id',
      'campaign_name',
      'adset_id',
      'adset_name',
      'ad_id',
      'ad_name',
      'spend',
      'reach',
      'impressions',
      'frequency',
      'clicks',
      'unique_clicks',
      'inline_link_clicks',
      'cpm',
      'cpc',
      'ctr',
      'actions',
      'action_values',
      'cost_per_action_type',
    ],
  } = options;

  const params = {
    access_token: token,
    level,
    time_increment: timeIncrement,
    fields: fields.join(','),
    limit: 500,
  };

  if (datePreset) {
    params.date_preset = datePreset;
  } else if (dateFrom && dateTo) {
    params.time_range = JSON.stringify({ since: dateFrom, until: dateTo });
  }

  return getWithRetry(
    `${GRAPH_API}/${normalizeAdAccountId(adAccountId)}/insights`,
    params,
    `insights:${normalizeAdAccountId(adAccountId)}`
  );
}

/**
 * Parse Meta actions array to extract specific action values.
 */
function parseActions(actions, actionType) {
  if (!actions) return 0;
  const action = actions.find((a) => a.action_type === actionType);
  return action ? parseFloat(action.value) : 0;
}

function parseActionValues(actionValues, actionType) {
  if (!actionValues) return 0;
  const action = actionValues.find((a) => a.action_type === actionType);
  return action ? parseFloat(action.value) : 0;
}

module.exports = {
  exchangeToken,
  refreshLongLivedToken,
  getAdAccounts,
  normalizeAdAccountId,
  getCampaigns,
  getAdSets,
  getAccountAdSets,
  getAds,
  getAccountAds,
  getInsights,
  getInsightsForAdAccount,
  getProductBreakdownInsights,
  parseActions,
  parseActionValues,
};
