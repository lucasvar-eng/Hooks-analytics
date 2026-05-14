const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { auth } = require('../middleware/auth');

// Endpoint público — la UI lo usa para mostrar info de la invitación antes del login.
router.get('/by-token/:token', teamController.lookupInvitation);

// Lista las invitaciones pendientes del user logueado (para el dropdown del header).
router.get('/mine', auth, teamController.listMyInvitations);

// Aceptar requiere auth — el email del user logueado debe coincidir con el de la invitación.
router.post('/accept', auth, teamController.acceptInvitation);

module.exports = router;
