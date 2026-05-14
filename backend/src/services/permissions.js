/**
 * permissions — service que centraliza la lógica de "qué puede hacer este
 * user en esta tienda".
 *
 * Modelo:
 *   - `User.role` (global): admin / analyst / viewer.
 *     Si es admin → bypass total: puede todo en cualquier tienda.
 *   - `StoreAccess.role` (por tienda): owner / admin / editor / viewer.
 *   - `StoreAccess.permissions[]`: overrides granulares por encima del rol.
 *
 * Uso:
 *   const ok = await canAccess(user, storeId, 'settings:write');
 *   const middleware = requirePermission('connections:write');
 *   const accesses = await getUserStoreAccesses(userId);
 *   const grant = await grantAccess({ userId, storeId, role, invitedBy });
 *
 * Catálogo de permisos:
 *   metrics:read        — leer métricas, dashboards
 *   metrics:export      — descargar CSV / reportes
 *   settings:read       — leer configuración (targets, costos)
 *   settings:write      — modificar configuración no sensible
 *   connections:read    — ver estado de integraciones (no incluye tokens)
 *   connections:write   — conectar / desconectar TN, Meta, Shopify, etc.
 *   sync:trigger        — forzar sync manual
 *   team:read           — listar miembros de la tienda
 *   team:invite         — invitar nuevos miembros
 *   team:remove         — quitar miembros
 *   team:role:change    — cambiar rol de un miembro existente
 *   store:delete        — eliminar la tienda
 *   store:transfer      — transferir ownership
 */
const StoreAccess = require('../models/StoreAccess');

const PERMISSIONS = Object.freeze({
  METRICS_READ: 'metrics:read',
  METRICS_EXPORT: 'metrics:export',
  SETTINGS_READ: 'settings:read',
  SETTINGS_WRITE: 'settings:write',
  CONNECTIONS_READ: 'connections:read',
  CONNECTIONS_WRITE: 'connections:write',
  SYNC_TRIGGER: 'sync:trigger',
  TEAM_READ: 'team:read',
  TEAM_INVITE: 'team:invite',
  TEAM_REMOVE: 'team:remove',
  TEAM_ROLE_CHANGE: 'team:role:change',
  STORE_DELETE: 'store:delete',
  STORE_TRANSFER: 'store:transfer',
});

const ROLE_PERMISSIONS = Object.freeze({
  owner: new Set(Object.values(PERMISSIONS)),
  admin: new Set([
    PERMISSIONS.METRICS_READ,
    PERMISSIONS.METRICS_EXPORT,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_WRITE,
    PERMISSIONS.CONNECTIONS_READ,
    PERMISSIONS.CONNECTIONS_WRITE,
    PERMISSIONS.SYNC_TRIGGER,
    PERMISSIONS.TEAM_READ,
    PERMISSIONS.TEAM_INVITE,
    PERMISSIONS.TEAM_REMOVE,
    PERMISSIONS.TEAM_ROLE_CHANGE,
  ]),
  editor: new Set([
    PERMISSIONS.METRICS_READ,
    PERMISSIONS.METRICS_EXPORT,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_WRITE,
    PERMISSIONS.CONNECTIONS_READ,
    PERMISSIONS.SYNC_TRIGGER,
    PERMISSIONS.TEAM_READ,
  ]),
  viewer: new Set([
    PERMISSIONS.METRICS_READ,
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.CONNECTIONS_READ,
    PERMISSIONS.TEAM_READ,
  ]),
});

const VALID_ROLES = Object.freeze(['owner', 'admin', 'editor', 'viewer']);
const VALID_PERMISSIONS = new Set(Object.values(PERMISSIONS));

function isGlobalAdmin(user) {
  return !!user && user.role === 'admin';
}

async function getAccess(userId, storeId) {
  if (!userId || !storeId) return null;
  return StoreAccess.findOne({ userId, storeId }).lean();
}

function permissionsFromAccess(access) {
  if (!access) return new Set();
  const base = ROLE_PERMISSIONS[access.role] || new Set();
  const result = new Set(base);
  for (const perm of access.permissions || []) {
    if (VALID_PERMISSIONS.has(perm)) result.add(perm);
  }
  return result;
}

async function canAccess(user, storeId, permission) {
  if (!user || !storeId || !permission) return false;
  if (isGlobalAdmin(user)) return true;

  if (!VALID_PERMISSIONS.has(permission)) {
    throw new Error(`Permiso inválido: ${permission}`);
  }

  const access = await getAccess(user._id, storeId);
  if (!access) return false;
  const perms = permissionsFromAccess(access);
  return perms.has(permission);
}

function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const storeId = req.storeId || req.params.storeId || req.params.id;
      if (!storeId) return res.status(400).json({ error: 'storeId required' });
      if (!req.user) return res.status(401).json({ error: 'unauthenticated' });

      if (isGlobalAdmin(req.user)) {
        return next();
      }

      const ok = await canAccess(req.user, storeId, permission);
      if (!ok) {
        return res.status(403).json({
          error: 'No tenés permiso para realizar esta acción',
          permissionMissing: permission,
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

async function getUserStoreAccesses(userId) {
  return StoreAccess.find({ userId }).lean();
}

async function getStoreMembers(storeId) {
  return StoreAccess.find({ storeId })
    .populate('userId', 'email nombre')
    .populate('invitedBy', 'email nombre')
    .lean();
}

async function grantAccess({ userId, storeId, role, permissions = [], invitedBy = null, acceptedAt = new Date() }) {
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`Rol inválido: ${role}`);
  }
  const sanitizedPerms = permissions.filter((p) => VALID_PERMISSIONS.has(p));
  return StoreAccess.findOneAndUpdate(
    { userId, storeId },
    {
      userId,
      storeId,
      role,
      permissions: sanitizedPerms,
      invitedBy,
      acceptedAt,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function revokeAccess(userId, storeId) {
  return StoreAccess.deleteOne({ userId, storeId });
}

async function updateAccessRole(userId, storeId, { role, permissions }) {
  const update = {};
  if (role !== undefined) {
    if (!VALID_ROLES.includes(role)) throw new Error(`Rol inválido: ${role}`);
    update.role = role;
  }
  if (permissions !== undefined) {
    update.permissions = (permissions || []).filter((p) => VALID_PERMISSIONS.has(p));
  }
  if (Object.keys(update).length === 0) return null;
  return StoreAccess.findOneAndUpdate({ userId, storeId }, update, { new: true });
}

async function hasAnyAccess(userId, storeId) {
  if (!userId || !storeId) return false;
  const count = await StoreAccess.countDocuments({ userId, storeId });
  return count > 0;
}

async function listStoreIdsForUser(userId) {
  const accesses = await StoreAccess.find({ userId }).select('storeId').lean();
  return accesses.map((a) => a.storeId);
}

module.exports = {
  PERMISSIONS,
  VALID_ROLES,
  isGlobalAdmin,
  canAccess,
  requirePermission,
  getAccess,
  getUserStoreAccesses,
  getStoreMembers,
  grantAccess,
  revokeAccess,
  updateAccessRole,
  hasAnyAccess,
  listStoreIdsForUser,
};
