const axios = require('axios');
const { tn } = require('../config/environment');

const CACHE_TTL = 5 * 60 * 1000;

const CENTRALIZED_TN_STORES = {
  '6444342': { label: 'MANGUZ' },
  '2638533': { label: 'Limite Deportes' },
  '5920984': { label: 'Pataforma' },
};

const tokenCache = {};

function normalizeStoreId(storeId) {
  return String(storeId || '').trim();
}

function isCentralizedTiendanubeStore(storeId) {
  return Boolean(CENTRALIZED_TN_STORES[normalizeStoreId(storeId)]);
}

function invalidateTiendanubeToken(storeId) {
  delete tokenCache[normalizeStoreId(storeId)];
}

async function getTiendanubeToken(storeId, { forceRefresh = false } = {}) {
  const normalizedStoreId = normalizeStoreId(storeId);

  if (!normalizedStoreId) {
    throw new Error('storeId is required');
  }

  if (!isCentralizedTiendanubeStore(normalizedStoreId)) {
    throw new Error(`No centralized token configured for Tienda Nube store ${normalizedStoreId}`);
  }

  if (!tn.croServiceApiKey) {
    throw new Error('CRO_SERVICE_API_KEY is not configured');
  }

  const cached = tokenCache[normalizedStoreId];
  if (!forceRefresh && cached && (Date.now() - cached.fetchedAt) < CACHE_TTL) {
    return cached.token;
  }

  const response = await axios.get(`${tn.croServiceApiUrl}/${normalizedStoreId}/token`, {
    headers: {
      Authorization: `Bearer ${tn.croServiceApiKey}`,
    },
  });

  const freshToken = response.data?.accessToken;
  if (!freshToken) {
    throw new Error(`Token service did not return an accessToken for store ${normalizedStoreId}`);
  }

  tokenCache[normalizedStoreId] = {
    token: freshToken,
    fetchedAt: Date.now(),
    updatedAt: response.data?.updatedAt || null,
  };

  return freshToken;
}

module.exports = {
  CENTRALIZED_TN_STORES,
  isCentralizedTiendanubeStore,
  invalidateTiendanubeToken,
  getTiendanubeToken,
};
