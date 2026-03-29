const express = require('express');
const router = express.Router();
const competitorController = require('../controllers/competitorController');
const { auth } = require('../middleware/auth');

router.get('/stores/:id/competitors', auth, competitorController.list);
router.post('/stores/:id/competitors', auth, competitorController.create);
router.put('/stores/:id/competitors/:competitorId', auth, competitorController.update);
router.delete('/stores/:id/competitors/:competitorId', auth, competitorController.remove);

module.exports = router;
