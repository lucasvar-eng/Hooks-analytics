const express = require('express');
const router = express.Router();
const userSettings = require('../controllers/userSettingsController');
const { auth } = require('../middleware/auth');

router.use(auth);

router.get('/notifications', userSettings.getNotifications);
router.put('/notifications', userSettings.updateNotifications);

router.get('/resend-config', userSettings.getResendConfig);
router.put('/resend-config', userSettings.updateResendConfig);
router.post('/resend-config/test', userSettings.testResendConfig);

router.get('/meta-token', userSettings.getMetaToken);
router.put('/meta-token', userSettings.updateMetaToken);
router.delete('/meta-token', userSettings.deleteMetaToken);
router.get('/meta-token/ad-accounts', userSettings.getMetaAdAccounts);

module.exports = router;
