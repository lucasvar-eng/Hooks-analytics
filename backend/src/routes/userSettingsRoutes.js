const express = require('express');
const router = express.Router();
const userSettings = require('../controllers/userSettingsController');
const { auth } = require('../middleware/auth');

router.use(auth);

router.get('/ai-config', userSettings.getAIConfig);
router.put('/ai-config', userSettings.updateAIConfig);
router.put('/ai-instructions', userSettings.updateGlobalInstructions);
router.post('/ai-files', userSettings.uploadGlobalFile);
router.delete('/ai-files/:filename', userSettings.deleteGlobalFile);
router.post('/ai-test', userSettings.testConnection);

router.get('/notifications', userSettings.getNotifications);
router.put('/notifications', userSettings.updateNotifications);

module.exports = router;
