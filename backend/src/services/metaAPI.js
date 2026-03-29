const axios = require('axios');
const logger = require('../utils/logger');

const GRAPH_API = 'https://graph.facebook.com/v19.0';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const res = await axios.get(`${GRAPH_API}/me/adaccounts`, {
    params: {
      access_token: token,
      fields: 'id,name,account_id,account_status,currency',
      limit: 50,
    },
  });
  return res.data.data;
}

/**
 * Get campaigns for an ad account.
 */
async function getCampaigns(adAccountId, token) {
  const res = await axios.get(`${GRAPH_API}/act_${adAccountId}/campaigns`, {
    params: {
      access_token: token,
      fields: 'id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time',
      limit: 500,
    },
  });
  return res.data.data;
}

/**
 * Get ad sets for a campaign.
 */
async function getAdSets(campaignId, token) {
  const res = await axios.get(`${GRAPH_API}/${campaignId}/adsets`, {
    params: {
      access_token: token,
      fields: 'id,name,status,daily_budget,lifetime_budget,targeting,optimization_goal',
      limit: 500,
    },
  });
  return res.data.data;
}

/**
 * Get ads for an ad set.
 */
async function getAds(adSetId, token) {
  const res = await axios.get(`${GRAPH_API}/${adSetId}/ads`, {
    params: {
      access_token: token,
      fields: 'id,name,status,creative{id,name,body,title,thumbnail_url}',
      limit: 500,
    },
  });
  return res.data.data;
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
      if (error.response?.status === 429 && retries < maxRetries) {
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
  getCampaigns,
  getAdSets,
  getAds,
  getInsights,
  parseActions,
  parseActionValues,
};
