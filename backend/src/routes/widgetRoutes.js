const express = require('express');
const router = express.Router();
const widgetController = require('../controllers/widgetController');
const { auth } = require('../middleware/auth');

router.get('/stores/:id/widgets', auth, widgetController.list);
router.post('/stores/:id/widgets', auth, widgetController.create);
router.post('/stores/:id/widgets/seed', auth, widgetController.seedDefaults);
router.post('/stores/:id/widgets/reset', auth, widgetController.resetDefaults);
router.put('/stores/:id/widgets/reorder', auth, widgetController.reorder);
router.put('/stores/:id/widgets/:widgetId', auth, widgetController.update);
router.delete('/stores/:id/widgets/:widgetId', auth, widgetController.remove);

module.exports = router;
