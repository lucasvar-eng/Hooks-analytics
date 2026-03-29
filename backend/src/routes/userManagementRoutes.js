const express = require('express');
const router = express.Router();
const userMgmt = require('../controllers/userManagementController');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth);
router.use(requireRole('admin'));

router.get('/', userMgmt.list);
router.post('/', userMgmt.create);
router.put('/:userId', userMgmt.update);
router.delete('/:userId', userMgmt.remove);

module.exports = router;
