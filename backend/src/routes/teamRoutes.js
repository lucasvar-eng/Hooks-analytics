const express = require('express');
const router = express.Router({ mergeParams: true });
const teamController = require('../controllers/teamController');
const { requirePermission, PERMISSIONS } = require('../services/permissions');

// Estas rutas se montan bajo /api/stores/:id (post auth + storeContext)
router.get('/', requirePermission(PERMISSIONS.TEAM_READ), teamController.listTeam);
router.post('/invitations', requirePermission(PERMISSIONS.TEAM_INVITE), teamController.invite);
router.delete('/invitations/:invitationId', requirePermission(PERMISSIONS.TEAM_INVITE), teamController.revokeInvitation);
router.put('/members/:userId', requirePermission(PERMISSIONS.TEAM_ROLE_CHANGE), teamController.updateMember);
router.delete('/members/:userId', requirePermission(PERMISSIONS.TEAM_REMOVE), teamController.removeMember);

module.exports = router;
