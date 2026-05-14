const User = require('../models/User');
const Store = require('../models/Store');
const StoreInvitation = require('../models/StoreInvitation');
const StoreAccess = require('../models/StoreAccess');
const permissions = require('../services/permissions');
const { logAudit } = require('../services/auditLogService');
const { sendEmail, buildInvitationEmail } = require('../services/emailService');
const { email: emailConfig } = require('../config/environment');
const logger = require('../utils/logger');

const INVITE_TTL_DAYS = 7;

function publicInvitation(inv) {
  return {
    _id: inv._id,
    storeId: inv.storeId,
    email: inv.email,
    role: inv.role,
    permissions: inv.permissions,
    status: inv.status,
    expiresAt: inv.expiresAt,
    acceptedAt: inv.acceptedAt,
    invitedBy: inv.invitedBy,
    createdAt: inv.createdAt,
  };
}

/**
 * POST /stores/:id/team/invitations
 * Body: { email, role, permissions? }
 * Requiere permiso team:invite.
 */
exports.invite = async (req, res, next) => {
  try {
    const storeId = req.storeId;
    const email = String(req.body.email || '').trim().toLowerCase();
    const role = req.body.role || 'viewer';
    const incomingPerms = Array.isArray(req.body.permissions) ? req.body.permissions : [];

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido (admin / editor / viewer)' });
    }

    const store = await Store.findById(storeId).select('nombre');
    if (!store) return res.status(404).json({ error: 'Store not found' });

    // Si el user ya existe + ya tiene acceso, no tiene sentido reinvitar
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      const hasAccess = await StoreAccess.findOne({ userId: existingUser._id, storeId });
      if (hasAccess) {
        return res.status(409).json({
          error: 'Ese usuario ya tiene acceso a esta tienda',
          currentRole: hasAccess.role,
        });
      }
    }

    const sanitizedPerms = incomingPerms.filter((p) =>
      Object.values(permissions.PERMISSIONS).includes(p)
    );
    const token = StoreInvitation.generateToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invitation = await StoreInvitation.findOneAndUpdate(
      { storeId, email, status: 'pending' },
      {
        storeId,
        email,
        role,
        permissions: sanitizedPerms,
        token,
        invitedBy: req.user._id,
        expiresAt,
        status: 'pending',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await logAudit({
      storeId,
      userId: req.user._id,
      action: 'team.invitation.created',
      entityType: 'StoreInvitation',
      entityId: invitation._id,
      details: { email, role, expiresAt },
    });

    logger.info(`Invitation created for ${email} → store ${store.nombre} (${role}) by ${req.user.email}`);

    const acceptUrl = `${emailConfig.appUrl}/invitations/accept?token=${token}`;
    const emailTemplate = buildInvitationEmail({
      invitedByName: req.user.nombre,
      invitedByEmail: req.user.email,
      storeName: store.nombre,
      role,
      acceptUrl,
      expiresAt,
    });

    const emailResult = await sendEmail({
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (emailResult.ok) {
      logger.info(`Invitation email sent to ${email} (resend id: ${emailResult.id})`);
    } else if (emailResult.skipped) {
      logger.warn(`Invitation email NOT sent (Resend disabled). acceptUrl: ${acceptUrl}`);
    } else {
      logger.error(`Failed to send invitation email to ${email}: ${emailResult.error}`);
    }

    res.status(201).json({
      invitation: publicInvitation(invitation),
      acceptUrl,
      emailSent: emailResult.ok === true,
      emailError: emailResult.ok ? null : emailResult.skipped ? 'email_disabled' : emailResult.error,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /stores/:id/team
 * Lista miembros (StoreAccess) + invitaciones pending.
 * Requiere team:read.
 */
exports.listTeam = async (req, res, next) => {
  try {
    const storeId = req.storeId;
    const [members, invitations] = await Promise.all([
      permissions.getStoreMembers(storeId),
      StoreInvitation.find({ storeId, status: 'pending' })
        .populate('invitedBy', 'email nombre')
        .lean(),
    ]);

    res.json({
      members: members.map((m) => ({
        _id: m._id,
        userId: m.userId?._id,
        email: m.userId?.email,
        nombre: m.userId?.nombre,
        role: m.role,
        permissions: m.permissions || [],
        invitedBy: m.invitedBy
          ? { _id: m.invitedBy._id, email: m.invitedBy.email, nombre: m.invitedBy.nombre }
          : null,
        acceptedAt: m.acceptedAt,
        lastAccessAt: m.lastAccessAt,
      })),
      invitations: invitations.map(publicInvitation),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /stores/:id/team/members/:userId
 * Requiere team:remove. No permite quitar al último owner.
 */
exports.removeMember = async (req, res, next) => {
  try {
    const storeId = req.storeId;
    const targetUserId = req.params.userId;
    if (!targetUserId) return res.status(400).json({ error: 'userId required' });

    const target = await StoreAccess.findOne({ storeId, userId: targetUserId });
    if (!target) return res.status(404).json({ error: 'Member not found' });

    if (target.role === 'owner') {
      const ownerCount = await StoreAccess.countDocuments({ storeId, role: 'owner' });
      if (ownerCount <= 1) {
        return res.status(400).json({
          error: 'No podés quitar al último owner. Transferí ownership primero.',
        });
      }
    }

    await permissions.revokeAccess(targetUserId, storeId);

    await logAudit({
      storeId,
      userId: req.user._id,
      action: 'team.member.removed',
      entityType: 'StoreAccess',
      entityId: target._id,
      details: { removedUserId: targetUserId, previousRole: target.role },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /stores/:id/team/members/:userId
 * Body: { role?, permissions? }
 * Requiere team:role:change.
 */
exports.updateMember = async (req, res, next) => {
  try {
    const storeId = req.storeId;
    const targetUserId = req.params.userId;

    const target = await StoreAccess.findOne({ storeId, userId: targetUserId });
    if (!target) return res.status(404).json({ error: 'Member not found' });

    if (target.role === 'owner' && req.body.role && req.body.role !== 'owner') {
      const ownerCount = await StoreAccess.countDocuments({ storeId, role: 'owner' });
      if (ownerCount <= 1) {
        return res.status(400).json({
          error: 'No podés degradar al último owner. Transferí ownership primero.',
        });
      }
    }

    const updated = await permissions.updateAccessRole(targetUserId, storeId, {
      role: req.body.role,
      permissions: req.body.permissions,
    });

    await logAudit({
      storeId,
      userId: req.user._id,
      action: 'team.member.updated',
      entityType: 'StoreAccess',
      entityId: target._id,
      details: {
        targetUserId,
        previousRole: target.role,
        newRole: req.body.role,
        permissions: req.body.permissions,
      },
    });

    res.json({ success: true, member: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /stores/:id/team/invitations/:invitationId
 * Revocar una invitación pendiente. Requiere team:invite.
 */
exports.revokeInvitation = async (req, res, next) => {
  try {
    const storeId = req.storeId;
    const invitationId = req.params.invitationId;

    const inv = await StoreInvitation.findOne({ _id: invitationId, storeId });
    if (!inv) return res.status(404).json({ error: 'Invitation not found' });
    if (inv.status !== 'pending') {
      return res.status(400).json({ error: `Invitación ya está ${inv.status}` });
    }

    inv.status = 'revoked';
    inv.revokedAt = new Date();
    inv.revokedBy = req.user._id;
    await inv.save();

    await logAudit({
      storeId,
      userId: req.user._id,
      action: 'team.invitation.revoked',
      entityType: 'StoreInvitation',
      entityId: inv._id,
      details: { email: inv.email, role: inv.role },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /invitations/mine
 * Lista las invitaciones pendientes para el email del user logueado.
 * Sirve para alimentar el dropdown de notificaciones del header.
 */
exports.listMyInvitations = async (req, res, next) => {
  try {
    const items = await StoreInvitation.find({
      email: req.user.email,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    })
      .populate('storeId', 'nombre logoUrl')
      .populate('invitedBy', 'email nombre')
      .sort({ createdAt: -1 })
      .lean();

    res.json(
      items.map((inv) => ({
        _id: inv._id,
        token: inv.token,
        role: inv.role,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        store: inv.storeId
          ? { _id: inv.storeId._id, nombre: inv.storeId.nombre, logoUrl: inv.storeId.logoUrl }
          : null,
        invitedBy: inv.invitedBy
          ? { email: inv.invitedBy.email, nombre: inv.invitedBy.nombre }
          : null,
      }))
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /invitations/by-token/:token
 * Endpoint público (sin auth) para que la UI pueda mostrar datos de la
 * invitación antes de loguearse. Devuelve solo la info no sensible.
 */
exports.lookupInvitation = async (req, res, next) => {
  try {
    const token = req.params.token;
    const inv = await StoreInvitation.findOne({ token })
      .populate('storeId', 'nombre logoUrl')
      .populate('invitedBy', 'email nombre');
    if (!inv) return res.status(404).json({ error: 'Invitación no encontrada' });

    res.json({
      email: inv.email,
      role: inv.role,
      status: inv.status,
      isUsable: inv.isUsable(),
      expiresAt: inv.expiresAt,
      store: inv.storeId
        ? { _id: inv.storeId._id, nombre: inv.storeId.nombre, logoUrl: inv.storeId.logoUrl }
        : null,
      invitedBy: inv.invitedBy
        ? { email: inv.invitedBy.email, nombre: inv.invitedBy.nombre }
        : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /invitations/accept
 * Body: { token }
 * Requiere usuario logueado. El email del invitado debe coincidir con req.user.email.
 */
exports.acceptInvitation = async (req, res, next) => {
  try {
    const token = String(req.body.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token required' });

    const inv = await StoreInvitation.findOne({ token });
    if (!inv) return res.status(404).json({ error: 'Invitación no encontrada' });

    if (inv.status === 'accepted') {
      return res.status(400).json({ error: 'Esta invitación ya fue aceptada' });
    }
    if (inv.status === 'revoked') {
      return res.status(400).json({ error: 'Esta invitación fue revocada' });
    }
    if (inv.expiresAt < new Date()) {
      inv.status = 'expired';
      await inv.save();
      return res.status(400).json({ error: 'La invitación expiró' });
    }

    if (inv.email !== req.user.email) {
      return res.status(403).json({
        error: 'Esta invitación es para otro email. Iniciá sesión con la cuenta correcta.',
      });
    }

    await permissions.grantAccess({
      userId: req.user._id,
      storeId: inv.storeId,
      role: inv.role,
      permissions: inv.permissions,
      invitedBy: inv.invitedBy,
    });

    inv.status = 'accepted';
    inv.acceptedAt = new Date();
    inv.acceptedByUser = req.user._id;
    await inv.save();

    await logAudit({
      storeId: inv.storeId,
      userId: req.user._id,
      action: 'team.invitation.accepted',
      entityType: 'StoreInvitation',
      entityId: inv._id,
      details: { email: inv.email, role: inv.role },
    });

    res.json({ success: true, storeId: inv.storeId, role: inv.role });
  } catch (error) {
    next(error);
  }
};
