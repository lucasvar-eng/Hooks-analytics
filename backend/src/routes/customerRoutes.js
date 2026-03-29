const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { auth } = require('../middleware/auth');

router.get('/stores/:id/customers', auth, customerController.list);
router.get('/stores/:id/customers/cohorts', auth, customerController.cohorts);
router.get('/stores/:id/customers/segments', auth, customerController.segments);
router.post('/stores/:id/customers/rfm', auth, customerController.recalculateRFM);

module.exports = router;
