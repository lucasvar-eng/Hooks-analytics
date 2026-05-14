const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { auth } = require('../middleware/auth');

// Endpoint público — la UI lo usa para mostrar info de la invitación antes del login.
// Solo expone datos no sensibles.
router.get('/by-token/:token', teamController.lookupInvitation);

// Aceptar requiere auth — el email del user logueado debe coincidir con el de la invitación.
router.post('/accept', auth, teamController.acceptInvitation);

module.exports = router;
