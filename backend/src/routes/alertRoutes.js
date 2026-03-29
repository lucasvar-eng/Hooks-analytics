const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { auth } = require('../middleware/auth');

router.get('/stores/:id/alerts', auth, alertController.list);
router.get('/alerts/active-counts', auth, alertController.listAllActiveCounts);
router.put('/stores/:id/alerts/:alertId/acknowledge', auth, alertController.acknowledge);
router.put('/stores/:id/alerts/:alertId/resolve', auth, alertController.resolve);

module.exports = router;
