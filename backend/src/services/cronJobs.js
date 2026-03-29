const cron = require('node-cron');
const Store = require('../models/Store');
const { syncOrders, syncProducts } = require('./syncTiendanube');
const logger = require('../utils/logger');

async function runForAllStores(jobName, syncFn) {
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

function startCronJobs() {
  // Sync TN orders every 4 hours
  cron.schedule('0 */4 * * *', () => {
    runForAllStores('syncTnOrders', syncOrders);
  });

  // Sync TN products every 12 hours
  cron.schedule('0 */12 * * *', () => {
    runForAllStores('syncTnProducts', syncProducts);
  });

  logger.info('Cron jobs scheduled: syncTnOrders (4h), syncTnProducts (12h)');
}

module.exports = { startCronJobs };
