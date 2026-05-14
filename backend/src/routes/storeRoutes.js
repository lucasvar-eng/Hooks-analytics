const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const settingsController = require('../controllers/settingsController');
const teamRoutes = require('./teamRoutes');
const { auth, requireRole } = require('../middleware/auth');
const storeContext = require('../middleware/storeContext');
const { requirePermission, PERMISSIONS } = require('../services/permissions');

// All store routes require auth
router.use(auth);

router.get('/', storeController.list);
router.get('/overview/executive', storeController.getExecutiveOverview);
// Crear tienda nueva: cualquier user autenticado que no sea viewer puede crearla.
router.post('/', requireRole('admin', 'analyst'), storeController.create);
router.post('/create-connected', requireRole('admin', 'analyst'), storeController.createConnected);

// A partir de acá, todo lo que sea /:id usa storeContext + permission checks
router.use('/:id', storeContext);

router.get('/:id', requirePermission(PERMISSIONS.METRICS_READ), storeController.getById);
router.put('/:id', requirePermission(PERMISSIONS.SETTINGS_WRITE), storeController.update);
router.delete('/:id', requirePermission(PERMISSIONS.STORE_DELETE), storeController.remove);

router.get('/:id/metrics', requirePermission(PERMISSIONS.METRICS_READ), storeController.getMetrics);
router.get('/:id/orders', requirePermission(PERMISSIONS.METRICS_READ), storeController.getOrders);
router.post('/:id/sync/now', requirePermission(PERMISSIONS.SYNC_TRIGGER), storeController.syncNow);

router.get('/:id/settings', requirePermission(PERMISSIONS.SETTINGS_READ), settingsController.getSettings);
router.put('/:id/settings', requirePermission(PERMISSIONS.SETTINGS_WRITE), settingsController.updateSettings);

router.get('/:id/targets', requirePermission(PERMISSIONS.SETTINGS_READ), settingsController.getTargets);
router.post('/:id/targets', requirePermission(PERMISSIONS.SETTINGS_WRITE), settingsController.upsertTarget);

router.get('/:id/import-batches', requirePermission(PERMISSIONS.SETTINGS_READ), settingsController.getImportBatches);
router.post('/:id/recalculate', requirePermission(PERMISSIONS.SYNC_TRIGGER), settingsController.recalculate);
router.post('/:id/recalculate-metrics', requirePermission(PERMISSIONS.SYNC_TRIGGER), settingsController.recalculateMetrics);

router.post('/:id/connect-tn-manual', requirePermission(PERMISSIONS.CONNECTIONS_WRITE), settingsController.connectTNManual);
router.post('/:id/connect-shopify-manual', requirePermission(PERMISSIONS.CONNECTIONS_WRITE), settingsController.connectShopifyManual);
router.post('/:id/meta/ad-accounts/preview', requirePermission(PERMISSIONS.CONNECTIONS_WRITE), settingsController.previewMetaAdAccounts);
router.post('/:id/connect-meta-manual', requirePermission(PERMISSIONS.CONNECTIONS_WRITE), settingsController.connectMetaManual);
router.post('/:id/meta/sync-now', requirePermission(PERMISSIONS.SYNC_TRIGGER), settingsController.syncMetaManual);

router.get('/:id/orders/:orderId', requirePermission(PERMISSIONS.METRICS_READ), storeController.getOrderDetail);
router.get('/:id/daily-metrics', requirePermission(PERMISSIONS.METRICS_READ), storeController.getDailyMetrics);
router.get('/:id/financial-consistency', requirePermission(PERMISSIONS.METRICS_READ), storeController.getFinancialConsistency);

router.get('/:id/connections', requirePermission(PERMISSIONS.CONNECTIONS_READ), storeController.getConnections);

router.post('/:id/generate-verdict-thresholds', requirePermission(PERMISSIONS.SETTINGS_WRITE), storeController.generateVerdictThresholds);

// Team management bajo /api/stores/:id/team (los handlers usan req.storeId del middleware)
router.use('/:id/team', teamRoutes);

module.exports = router;
