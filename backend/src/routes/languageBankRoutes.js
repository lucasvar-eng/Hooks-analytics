const express = require('express');
const router = express.Router();
const languageBankController = require('../controllers/languageBankController');
const { auth } = require('../middleware/auth');
const storeContext = require('../middleware/storeContext');

router.use('/stores/:id', auth, storeContext);

router.get('/stores/:id/language-bank', auth, languageBankController.list);
router.get('/stores/:id/language-bank/overview', auth, languageBankController.overview);
router.post('/stores/:id/language-bank', auth, languageBankController.create);
router.put('/stores/:id/language-bank/:entryId', auth, languageBankController.update);
router.delete('/stores/:id/language-bank/:entryId', auth, languageBankController.remove);

module.exports = router;
