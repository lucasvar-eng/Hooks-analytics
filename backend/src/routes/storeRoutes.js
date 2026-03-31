const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const settingsController = require('../controllers/settingsController');
const storeAIContext = require('../controllers/storeAIContextController');
const { auth, requireRole } = require('../middleware/auth');
const storeContext = require('../middleware/storeContext');

// All store routes require auth
router.use(auth);

router.get('/', storeController.list);
router.get('/overview/executive', storeController.getExecutiveOverview);
router.post('/', requireRole('admin'), storeController.create);
router.post('/create-connected', requireRole('admin'), storeController.createConnected);
router.use('/:id', storeContext);
router.get('/:id', storeController.getById);
router.put('/:id', requireRole('admin', 'analyst'), storeController.update);
router.delete('/:id', requireRole('admin'), storeController.remove);
router.get('/:id/metrics', storeController.getMetrics);
router.get('/:id/orders', storeController.getOrders);
router.post('/:id/sync/now', requireRole('admin'), storeController.syncNow);
router.get('/:id/settings', settingsController.getSettings);
router.put('/:id/settings', requireRole('admin', 'analyst'), settingsController.updateSettings);
router.get('/:id/targets', settingsController.getTargets);
router.post('/:id/targets', requireRole('admin', 'analyst'), settingsController.upsertTarget);
router.get('/:id/import-batches', settingsController.getImportBatches);
router.post('/:id/recalculate', requireRole('admin'), settingsController.recalculate);
router.post('/:id/connect-tn-manual', requireRole('admin'), settingsController.connectTNManual);
router.post('/:id/connect-shopify-manual', requireRole('admin'), settingsController.connectShopifyManual);
router.post('/:id/meta/ad-accounts/preview', requireRole('admin'), settingsController.previewMetaAdAccounts);
router.post('/:id/connect-meta-manual', requireRole('admin'), settingsController.connectMetaManual);
router.post('/:id/meta/sync-now', requireRole('admin'), settingsController.syncMetaManual);
router.get('/:id/orders/:orderId', storeController.getOrderDetail);
router.get('/:id/daily-metrics', storeController.getDailyMetrics);
router.get('/:id/financial-consistency', storeController.getFinancialConsistency);

// Verdict thresholds AI generation
router.post('/:id/generate-verdict-thresholds', requireRole('admin', 'analyst'), storeController.generateVerdictThresholds);

// AI context per store
router.get('/:id/ai-context', storeAIContext.getAIContext);
router.put('/:id/ai-context', requireRole('admin', 'analyst'), storeAIContext.updateAIContext);
router.post('/:id/ai-context/files', requireRole('admin', 'analyst'), storeAIContext.uploadStoreFile);
router.delete('/:id/ai-context/files/:filename', requireRole('admin', 'analyst'), storeAIContext.deleteStoreFile);

module.exports = router;
