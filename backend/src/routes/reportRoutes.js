const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { auth } = require('../middleware/auth');
const storeContext = require('../middleware/storeContext');
const asyncHandler = require('../middleware/asyncHandler');

router.use('/stores/:id', auth, storeContext);

// Catálogo de templates (no requiere storeId — el storeContext es opcional acá)
router.get('/reports/templates', auth, asyncHandler(reportController.listTemplates));

// Briefing para un template + tienda + período (la IA externa consume esto)
router.get('/stores/:id/reports/templates/:templateKey/briefing', auth, asyncHandler(reportController.getTemplateBriefing));

router.get('/stores/:id/reports', auth, asyncHandler(reportController.list));
router.get('/stores/:id/reports/:reportId', auth, asyncHandler(reportController.getById));
router.post('/stores/:id/reports', auth, asyncHandler(reportController.create));
router.get('/stores/:id/reports/:reportId/export', auth, asyncHandler(reportController.exportReport));
router.delete('/stores/:id/reports/:reportId', auth, asyncHandler(reportController.remove));

module.exports = router;
