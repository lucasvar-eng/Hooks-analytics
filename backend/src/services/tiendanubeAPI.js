const axios = require('axios');
const logger = require('../utils/logger');
const {
  getTiendanubeToken,
  invalidateTiendanubeToken,
  isCentralizedTiendanubeStore,
} = require('../utils/tiendanubeToken');

const TN_BASE_URL = 'https://api.tiendanube.com/v1';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryableTnError(error) {
  const status = error.response?.status;
  return status === 429 || status === 502 || status === 503 || status === 504;
}

async function resolveToken(storeId, explicitToken, { forceRefresh = false } = {}) {
  if (explicitToken) return explicitToken;
  if (isCentralizedTiendanubeStore(storeId)) {
    return getTiendanubeToken(storeId, { forceRefresh });
  }
  throw new Error(`No Tienda Nube token available for store ${storeId}`);
}

/**
 * TiendaNube API wrapper with auth and rate limiting.
 */
const tiendanubeAPI = {
  async get(storeId, endpoint, token, params = {}, attempt = 0) {
    const url = `${TN_BASE_URL}/${storeId}${endpoint}`;
    const resolvedToken = await resolveToken(storeId, token);
    try {
      const response = await axios.get(url, {
        params,
        headers: {
          Authentication: `bearer ${resolvedToken}`,
          'User-Agent': 'ecom-analytics (lucasvar@gmail.com)',
          'Content-Type': 'application/json',
        },
      });
      return response;
    } catch (error) {
      if (isRetryableTnError(error) && attempt < 5) {
        const waitTime = error.response?.status === 429 ? 2000 : Math.pow(2, attempt + 1) * 2000;
        logger.warn(`TN API retry ${attempt + 1}/5 on ${endpoint} after ${error.response?.status}, waiting ${waitTime}ms...`);
        await sleep(waitTime);
        return tiendanubeAPI.get(storeId, endpoint, token, params, attempt + 1);
      }
      if (error.response?.status === 401 && !token && isCentralizedTiendanubeStore(storeId)) {
        invalidateTiendanubeToken(storeId);
        const freshToken = await resolveToken(storeId, null, { forceRefresh: true });
        const retryResponse = await axios.get(url, {
          params,
          headers: {
            Authentication: `bearer ${freshToken}`,
            'User-Agent': 'ecom-analytics (lucasvar@gmail.com)',
            'Content-Type': 'application/json',
          },
        });
        return retryResponse;
      }
      logger.error(`TN API error: ${error.response?.status} ${endpoint}`);
      throw error;
    }
  },

  async validateConnection(storeId, token) {
    const [storeResponse] = await Promise.all([
      tiendanubeAPI.get(storeId, '/store', token),
      tiendanubeAPI.get(storeId, '/products', token, {
        per_page: 1,
        fields: 'id',
      }),
      tiendanubeAPI.get(storeId, '/orders', token, {
        per_page: 1,
        fields: 'id',
        status: 'any',
      }),
    ]);

    return storeResponse.data;
  },
};

module.exports = tiendanubeAPI;
