const express = require('express');
const router = express.Router();
const creativeController = require('../controllers/creativeController');
const { auth } = require('../middleware/auth');

router.get('/stores/:id/creativos', auth, creativeController.getCreativos);
router.get('/stores/:id/creativos/campaigns', auth, creativeController.getCampaignResults);

module.exports = router;
