const express = require('express');
const router = express.Router();
const insightController = require('../controllers/insightController');
const { auth } = require('../middleware/auth');

router.get('/stores/:id/insights', auth, insightController.list);
router.get('/stores/:id/insights/top', auth, insightController.getTopInsight);
router.post('/stores/:id/insights', auth, insightController.create);
router.post('/stores/:id/insights/generate', auth, insightController.generate);
router.put('/stores/:id/insights/:insightId/dismiss', auth, insightController.dismiss);
router.put('/stores/:id/insights/:insightId/resolve', auth, insightController.resolve);
router.put('/stores/:id/insights/:insightId/pin', auth, insightController.pin);

module.exports = router;
