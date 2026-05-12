const express = require('express');
const router = express.Router();
const cashflowController = require('../controllers/cashflowController');
const { auth } = require('../middleware/auth');
const storeContext = require('../middleware/storeContext');

router.use('/stores/:id', auth, storeContext);

router.get('/stores/:id/cashflow/summary', auth, cashflowController.getSummary);
router.get('/stores/:id/cashflow/forecast', auth, cashflowController.getForecast);
router.get('/stores/:id/cashflow/daily', auth, cashflowController.getDaily);
router.post('/stores/:id/cashflow/regenerate', auth, cashflowController.regenerate);

// Movimientos manuales
router.get('/stores/:id/cashflow/categories', auth, cashflowController.getCategories);
router.get('/stores/:id/cashflow/manual', auth, cashflowController.listManualEntries);
router.post('/stores/:id/cashflow/manual', auth, cashflowController.upsertManualEntry);
router.delete('/stores/:id/cashflow/manual/:entryId', auth, cashflowController.deleteManualEntry);

// Cuentas bancarias / saldos
router.get('/stores/:id/cashflow/accounts', auth, cashflowController.listAccounts);
router.post('/stores/:id/cashflow/accounts', auth, cashflowController.upsertAccount);
router.delete('/stores/:id/cashflow/accounts/:accountId', auth, cashflowController.archiveAccount);

// Forecast unificado con cash gap
router.get('/stores/:id/cashflow/projection', auth, cashflowController.getProjection);

module.exports = router;
