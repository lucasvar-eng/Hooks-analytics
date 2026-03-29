const express = require('express');
const router = express.Router();
const tnOAuthController = require('../controllers/tnOAuthController');
const { auth } = require('../middleware/auth');

router.get('/connect/:storeId', auth, tnOAuthController.connect);
router.get('/callback', tnOAuthController.callback); // No auth — TN redirects here

module.exports = router;
