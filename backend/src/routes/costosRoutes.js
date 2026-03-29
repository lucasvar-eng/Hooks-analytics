const express = require('express');
const multer = require('multer');
const router = express.Router();
const costosController = require('../controllers/costosController');
const { auth, requireRole } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/stores/:id/products/costs', auth, requireRole('admin', 'analyst'), upload.single('file'), costosController.uploadProductCosts);
router.get('/stores/:id/products/costs/template', auth, costosController.downloadTemplate);
router.put('/stores/:id/settings/costos', auth, requireRole('admin'), costosController.updateCostos);
router.get('/stores/:id/pnl', auth, costosController.getPnL);
router.get('/stores/:id/breakeven', auth, costosController.getBreakeven);

module.exports = router;
