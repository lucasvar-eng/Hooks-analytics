const express = require('express');
const multer = require('multer');
const router = express.Router();
const costosController = require('../controllers/costosController');
const { auth, requireRole } = require('../middleware/auth');
const storeContext = require('../middleware/storeContext');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use('/stores/:id', auth, storeContext);

router.post('/stores/:id/products/costs', auth, requireRole('admin', 'analyst'), upload.single('file'), costosController.uploadProductCosts);
router.get('/stores/:id/products/costs/template', auth, costosController.downloadTemplate);
router.put('/stores/:id/settings/costos', auth, requireRole('admin'), costosController.updateCostos);
router.get('/stores/:id/pnl', auth, costosController.getPnL);
router.get('/stores/:id/breakeven', auth, costosController.getBreakeven);
router.get('/stores/:id/fixed-costs', auth, costosController.listFixedCosts);
router.post('/stores/:id/fixed-costs', auth, requireRole('admin', 'analyst'), costosController.createFixedCost);
router.delete('/stores/:id/fixed-costs/:fixedCostId', auth, requireRole('admin', 'analyst'), costosController.deleteFixedCost);

module.exports = router;
