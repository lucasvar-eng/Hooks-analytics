const express = require('express');
const router = express.Router();
const competitorController = require('../controllers/competitorController');
const { auth } = require('../middleware/auth');
const storeContext = require('../middleware/storeContext');

router.use('/stores/:id', auth, storeContext);

router.get('/stores/:id/competitors', auth, competitorController.list);
router.get('/stores/:id/competitors/overview', auth, competitorController.overview);
router.post('/stores/:id/competitors', auth, competitorController.create);
router.put('/stores/:id/competitors/:competitorId', auth, competitorController.update);
router.delete('/stores/:id/competitors/:competitorId', auth, competitorController.remove);
router.post('/stores/:id/competitors/:competitorId/analyze', auth, competitorController.analyze);
router.post('/stores/:id/competitors/:competitorId/opportunities', auth, competitorController.opportunities);

module.exports = router;
