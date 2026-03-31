const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { auth } = require('../middleware/auth');
const storeContext = require('../middleware/storeContext');

router.use('/stores/:id', auth, storeContext);

router.get('/stores/:id/reports', auth, reportController.list);
router.get('/stores/:id/reports/:reportId', auth, reportController.getById);
router.post('/stores/:id/reports', auth, reportController.create);
router.get('/stores/:id/reports/:reportId/export', auth, reportController.exportReport);
router.delete('/stores/:id/reports/:reportId', auth, reportController.remove);

module.exports = router;
