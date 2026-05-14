const mongoose = require('mongoose');

/**
 * StoreAccess — ACL granular por (user, store).
 *
 * Reemplaza el array User.storeAccess (que era solo "tiene acceso o no").
 * Ahora cada acceso tiene un rol y, opcionalmente, una lista de permisos
 * extra/override.
 *
 * El rol GLOBAL del User (`User.role`) sigue existiendo y aplica al sistema:
 *   - admin global: bypassa toda la ACL, acceso total a cualquier tienda.
 *   - analyst / viewer global: deben tener un StoreAccess para cada tienda
 *     a la que entran.
 *
 * Roles dentro de una tienda (StoreAccess.role):
 *   - owner    → todo + eliminar tienda + transferir ownership
 *   - admin    → todo menos eliminar la tienda
 *   - editor   → leer + modificar config no sensible (targets, costos)
 *                NO conecta integraciones ni invita usuarios
 *   - viewer   → solo lectura
 *
 * El array `permissions` es un OVERRIDE granular sobre el rol. Ejemplo:
 *   { role: 'viewer', permissions: ['metrics:export'] }
 * Le da export aunque su rol base sea viewer.
 *
 * Los permisos válidos viven en services/permissions.js (catálogo PERMISSIONS).
 */
const storeAccessSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'editor', 'viewer'],
      default: 'viewer',
      required: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    acceptedAt: { type: Date },
    lastAccessAt: { type: Date },
  },
  { timestamps: true }
);

storeAccessSchema.index({ userId: 1, storeId: 1 }, { unique: true });
storeAccessSchema.index({ storeId: 1, role: 1 });

module.exports = mongoose.model('StoreAccess', storeAccessSchema);
