const express = require('express');
const router = express.Router();
const tiendaController = require('../controllers/tiendaController');
const { auth, requireRole } = require('../middleware/auth');
const storeContext = require('../middleware/storeContext');

router.use('/stores/:id', auth, storeContext);

router.get('/stores/:id/tienda/breakdown', auth, tiendaController.getBreakdown);
router.get('/stores/:id/tienda/audit', auth, tiendaController.getAudit);
router.get('/stores/:id/tienda/sync-status', auth, tiendaController.getSyncStatus);
router.post('/stores/:id/tienda/reconcile', auth, requireRole('admin', 'analyst'), tiendaController.reconcile);
router.post('/stores/:id/tienda/rebuild-history', auth, requireRole('admin', 'analyst'), tiendaController.rebuildHistory);

module.exports = router;
