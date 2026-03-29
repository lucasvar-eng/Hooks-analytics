const express = require('express');
const router = express.Router();
const languageBankController = require('../controllers/languageBankController');
const { auth } = require('../middleware/auth');

router.get('/stores/:id/language-bank', auth, languageBankController.list);
router.post('/stores/:id/language-bank', auth, languageBankController.create);
router.put('/stores/:id/language-bank/:entryId', auth, languageBankController.update);
router.delete('/stores/:id/language-bank/:entryId', auth, languageBankController.remove);

module.exports = router;
