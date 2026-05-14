const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { auth } = require('../middleware/auth');
const storeContext = require('../middleware/storeContext');
const asyncHandler = require('../middleware/asyncHandler');

router.use('/stores/:id', auth, storeContext);

router.get('/stores/:id/reports', auth, asyncHandler(reportController.list));
router.get('/stores/:id/reports/:reportId', auth, asyncHandler(reportController.getById));
router.post('/stores/:id/reports', auth, asyncHandler(reportController.create));
router.get('/stores/:id/reports/:reportId/export', auth, asyncHandler(reportController.exportReport));
router.delete('/stores/:id/reports/:reportId', auth, asyncHandler(reportController.remove));

module.exports = router;
