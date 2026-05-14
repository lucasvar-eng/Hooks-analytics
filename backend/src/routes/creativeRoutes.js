const express = require('express');
const router = express.Router();
const creativeController = require('../controllers/creativeController');
const { auth } = require('../middleware/auth');
const storeContext = require('../middleware/storeContext');

router.use('/stores/:id', auth, storeContext);

router.get('/stores/:id/creativos', auth, creativeController.getCreativos);
router.get('/stores/:id/creativos/campaigns', auth, creativeController.getCampaignResults);
router.get('/stores/:id/creativos/framework-overview', auth, creativeController.getFrameworkOverview);
router.get('/stores/:id/creativos/pipeline', auth, creativeController.getCreativePipeline);
router.get('/stores/:id/creativos/master-sheet', auth, creativeController.getCreativeMasterSheet);
router.post('/stores/:id/creativos/master-sheet/sync', auth, creativeController.syncCreativeMasterSheet);
router.get('/stores/:id/creativos/angles', auth, creativeController.getAngles);
router.get('/stores/:id/creativos/analyses', auth, creativeController.getAllAnalyses);

module.exports = router;
