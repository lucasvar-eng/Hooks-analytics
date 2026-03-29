const express = require('express');
const router = express.Router();
const cashflowController = require('../controllers/cashflowController');
const { auth } = require('../middleware/auth');

router.get('/stores/:id/cashflow/summary', auth, cashflowController.getSummary);
router.get('/stores/:id/cashflow/forecast', auth, cashflowController.getForecast);
router.get('/stores/:id/cashflow/daily', auth, cashflowController.getDaily);
router.post('/stores/:id/cashflow/regenerate', auth, cashflowController.regenerate);

module.exports = router;
