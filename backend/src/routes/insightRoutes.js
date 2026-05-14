const express = require('express');
const router = express.Router();
const insightController = require('../controllers/insightController');
const insightsController = require('../controllers/insightsController');
const { auth } = require('../middleware/auth');
const storeContext = require('../middleware/storeContext');

router.use('/stores/:id', auth, storeContext);

// Insights persistidos (legacy: notas creadas manualmente o desde IA)
router.get('/stores/:id/insights', auth, insightController.list);
router.get('/stores/:id/insights/top', auth, insightController.getTopInsight);
router.post('/stores/:id/insights', auth, insightController.create);
router.put('/stores/:id/insights/:insightId/dismiss', auth, insightController.dismiss);
router.put('/stores/:id/insights/:insightId/resolve', auth, insightController.resolve);
router.put('/stores/:id/insights/:insightId/pin', auth, insightController.pin);

// Auto-insights determinísticos (Wins / Problemas / Recordatorios)
// — calculados al vuelo, sin IA
router.get('/stores/:id/auto-insights', auth, insightsController.get);

module.exports = router;
