const express = require('express');
const router = express.Router();
const mediaPlanningController = require('../controllers/mediaPlanningController');
const { auth } = require('../middleware/auth');
const storeContext = require('../middleware/storeContext');
const asyncHandler = require('../middleware/asyncHandler');

router.use('/stores/:id', auth, storeContext);

router.get(
  '/stores/:id/media-planning/spend-vs-sellability',
  auth,
  asyncHandler(mediaPlanningController.spendVsSellability)
);

router.get(
  '/stores/:id/media-planning/push-segments',
  auth,
  asyncHandler(mediaPlanningController.pushSegments)
);

router.get(
  '/stores/:id/media-planning/feed-health',
  auth,
  asyncHandler(mediaPlanningController.feedHealth)
);

module.exports = router;
