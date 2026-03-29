const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth, requireRole } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/register', auth, requireRole('admin'), authController.register);
router.get('/me', auth, authController.me);

module.exports = router;