const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { auth } = require('../middleware/auth');
const storeContext = require('../middleware/storeContext');

router.use('/stores/:id', auth, storeContext);

router.post('/stores/:id/ai/analyze', auth, aiController.analyze);
router.post('/stores/:id/ai/chat', auth, aiController.chat);
router.get('/stores/:id/ai/chat', auth, aiController.getConversation);
router.delete('/stores/:id/ai/chat', auth, aiController.clearConversation);
router.post('/stores/:id/ai/workflows/creative-brief', auth, aiController.generateCreativeBrief);
router.post('/ai/test-connection', auth, aiController.testConnection);

module.exports = router;
