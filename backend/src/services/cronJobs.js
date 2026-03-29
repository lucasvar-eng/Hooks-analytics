const cron = require('node-cron');
const Store = require('../models/Store');
const { syncOrders, syncProducts } = require('./syncTiendanube');
const { syncMetaStructure, syncMetaInsights, refreshMetaTokens } = require('./syncMeta');
const logger = require('../utils/logger');

async function runForTnStores(jobName, syncFn) {
  logger.info(`Cron: ${jobName} starting...`);
  const stores = await Store.find({
    'integrationStatus.tiendanube.connected': true,
    tnAccessToken: { $exists: true, $ne: '' },
  });

  for (const store of stores) {
    try {
      await syncFn(store);
    } catch (error) {
      logger.error(`Cron ${jobName} failed for ${store.nombre}: ${error.message}`);
    }
  }
  logger.info(`Cron: ${jobName} finished (${stores.length} stores)`);
}

async function runForMetaStores(jobName, syncFn) {
  logger.info(`Cron: ${jobName} starting...`);
  const stores = await Store.find({
    'integrationStatus.metaAds.connected': true,
    metaAccessToken: { $exists: true, $ne: '' },
  });

  for (const store of stores) {
    try {
      await syncFn(store);
    } catch (error) {
      logger.error(`Cron ${jobName} failed for ${store.nombre}: ${error.message}`);
    }
  }
  logger.info(`Cron: ${jobName} finished (${stores.length} stores)`);
}

function startCronJobs() {
  // TiendaNube
  cron.schedule('0 */4 * * *', () => runForTnStores('syncTnOrders', syncOrders));
  cron.schedule('0 */12 * * *', () => runForTnStores('syncTnProducts', syncProducts));

  // Meta Ads
  cron.schedule('30 */12 * * *', () => runForMetaStores('syncMetaStructure', syncMetaStructure));
  cron.schedule('0 1,7,13,19 * * *', () => runForMetaStores('syncMetaInsights', syncMetaInsights));
  cron.schedule('0 2 * * *', () => runForMetaStores('refreshMetaTokens', refreshMetaTokens));

  logger.info('Cron jobs scheduled: TN orders(4h), TN products(12h), Meta structure(12h), Meta insights(4x/day), Meta tokens(daily)');
}

module.exports = { startCronJobs };
