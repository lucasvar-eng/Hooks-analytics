const cron = require('node-cron');
const Store = require('../models/Store');
const { syncOrders, syncProducts, checkTiendanubeTokenHealth } = require('./syncTiendanube');
const { syncMetaStructure, syncMetaInsights, syncMetaProductInsights, refreshMetaTokens } = require('./syncMeta');
const { updateCashflowStates } = require('./cashflow');
const { runDiagnostics } = require('./diagnosticsService');
const storeConnections = require('./storeConnections');
const logger = require('../utils/logger');

async function runForTnStores(jobName, syncFn) {
  logger.info(`Cron: ${jobName} starting...`);

  // Lista de stores con conexión TN activa O con token centralizado (cro_service)
  // que vive fuera del modelo StoreConnection.
  const connectedStoreIds = await storeConnections.findActiveStoresByProvider('tiendanube');
  const centralizedStores = await Store.find({
    'integrationStatus.tiendanube.connected': true,
    tnTokenSource: 'cro_service',
  }).select('_id');

  const allIds = new Set([
    ...connectedStoreIds.map((id) => String(id)),
    ...centralizedStores.map((s) => String(s._id)),
  ]);

  const stores = await Store.find({ _id: { $in: Array.from(allIds) } });

  for (const store of stores) {
    try {
      await syncFn(store);
    } catch (error) {
      logger.error(`Cron ${jobName} failed for ${store.nombre}: ${error.message}`);
    }
  }
  logger.info(`Cron: ${jobName} finished (${stores.length} stores)`);
}

async function runTiendanubeTokenHealthCheck() {
  logger.info('Cron: tnTokenHealthCheck starting...');
  const stores = await Store.find({
    'integrationStatus.tiendanube.connected': true,
    tnTokenSource: 'cro_service',
  });

  for (const store of stores) {
    try {
      await checkTiendanubeTokenHealth(store);
    } catch (error) {
      logger.error(`Cron tnTokenHealthCheck failed for ${store.nombre}: ${error.message}`);
    }
  }

  logger.info(`Cron: tnTokenHealthCheck finished (${stores.length} stores)`);
}

async function runForMetaStores(jobName, syncFn) {
  logger.info(`Cron: ${jobName} starting...`);
  const storeIds = await storeConnections.findActiveStoresByProvider('meta');
  const stores = await Store.find({ _id: { $in: storeIds } });

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
  cron.schedule('15 */2 * * *', () => runTiendanubeTokenHealthCheck());
  cron.schedule('0 */4 * * *', () => runForTnStores('syncTnOrders', syncOrders));
  cron.schedule('0 */12 * * *', () => runForTnStores('syncTnProducts', syncProducts));

  // Meta Ads
  cron.schedule('30 */12 * * *', () => runForMetaStores('syncMetaStructure', syncMetaStructure));
  cron.schedule('0 1,7,13,19 * * *', () => runForMetaStores('syncMetaInsights', syncMetaInsights));
  cron.schedule('30 8,20 * * *', () => runForMetaStores('syncMetaProductInsights', syncMetaProductInsights));
  cron.schedule('0 2 * * *', () => runForMetaStores('refreshMetaTokens', refreshMetaTokens));

  // Cashflow
  cron.schedule('0 3 * * *', async () => {
    logger.info('Cron: updateCashflowStates starting...');
    try {
      await updateCashflowStates();
    } catch (error) {
      logger.error(`Cron updateCashflowStates failed: ${error.message}`);
    }
    logger.info('Cron: updateCashflowStates finished');
  });

  // Diagnostics (alerts)
  cron.schedule('0 */6 * * *', async () => {
    logger.info('Cron: diagnostics starting...');
    try {
      const stores = await Store.find({
        'objetivos.kpis': { $exists: true },
      });
      for (const store of stores) {
        try {
          await runDiagnostics(store);
        } catch (error) {
          logger.error(`Cron diagnostics failed for ${store.nombre}: ${error.message}`);
        }
      }
      logger.info(`Cron: diagnostics finished (${stores.length} stores)`);
    } catch (error) {
      logger.error(`Cron diagnostics failed: ${error.message}`);
    }
  });

  logger.info('Cron jobs scheduled: TN token health(2h), TN orders(4h), TN products(12h), Meta structure(12h), Meta insights(4x/day), Meta product breakdown(2x/day), Meta tokens(daily), Cashflow states(daily), Diagnostics(6h)');
}

module.exports = { startCronJobs };
