const express = require('express');
const router = express.Router();
const userSettings = require('../controllers/userSettingsController');
const { auth } = require('../middleware/auth');

router.use(auth);

router.get('/notifications', userSettings.getNotifications);
router.put('/notifications', userSettings.updateNotifications);

module.exports = router;
