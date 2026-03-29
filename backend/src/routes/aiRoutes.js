const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { auth } = require('../middleware/auth');

router.post('/stores/:id/ai/analyze', auth, aiController.analyze);
router.post('/stores/:id/ai/chat', auth, aiController.chat);
router.post('/ai/test-connection', auth, aiController.testConnection);

module.exports = router;
