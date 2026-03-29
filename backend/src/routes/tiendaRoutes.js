const express = require('express');
const router = express.Router();
const tiendaController = require('../controllers/tiendaController');
const { auth } = require('../middleware/auth');

router.get('/stores/:id/tienda/breakdown', auth, tiendaController.getBreakdown);

module.exports = router;
