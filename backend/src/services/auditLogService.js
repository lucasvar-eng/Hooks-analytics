const AuditLog = require('../models/AuditLog');

async function logAudit({
  storeId,
  userId,
  action,
  entityType,
  entityId,
  details,
}) {
  try {
    await AuditLog.create({
      storeId,
      userId,
      action,
      entityType,
      entityId: entityId ? String(entityId) : undefined,
      details: details || {},
    });
  } catch {
    // Audit logs should not break user flows.
  }
}

module.exports = { logAudit };
