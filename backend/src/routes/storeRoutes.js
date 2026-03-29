const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const { auth, requireRole } = require('../middleware/auth');

// All store routes require auth
router.use(auth);

router.get('/', storeController.list);
router.post('/', requireRole('admin'), storeController.create);
router.get('/:id', storeController.getById);
router.put('/:id', requireRole('admin', 'analyst'), storeController.update);
router.get('/:id/metrics', storeController.getMetrics);
router.get('/:id/orders', storeController.getOrders);
router.post('/:id/sync/now', requireRole('admin'), storeController.syncNow);

module.exports = router;
