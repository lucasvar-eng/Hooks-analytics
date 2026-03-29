const axios = require('axios');
const logger = require('../utils/logger');

const TN_BASE_URL = 'https://api.tiendanube.com/v1';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * TiendaNube API wrapper with auth and rate limiting.
 */
const tiendanubeAPI = {
  async get(storeId, endpoint, token, params = {}) {
    const url = `${TN_BASE_URL}/${storeId}${endpoint}`;
    try {
      const response = await axios.get(url, {
        params,
        headers: {
          Authentication: `bearer ${token}`,
          'User-Agent': 'ecom-analytics (lucasvar@gmail.com)',
          'Content-Type': 'application/json',
        },
      });
      return response;
    } catch (error) {
      if (error.response?.status === 429) {
        logger.warn(`TN rate limit hit, waiting 2s...`);
        await sleep(2000);
        return tiendanubeAPI.get(storeId, endpoint, token, params);
      }
      logger.error(`TN API error: ${error.response?.status} ${endpoint}`);
      throw error;
    }
  },
};

module.exports = tiendanubeAPI;
