const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { auth } = require('../middleware/auth');

router.get('/stores/:id/reports', auth, reportController.list);
router.get('/stores/:id/reports/:reportId', auth, reportController.getById);
router.post('/stores/:id/reports', auth, reportController.create);
router.delete('/stores/:id/reports/:reportId', auth, reportController.remove);

module.exports = router;
