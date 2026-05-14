const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * StoreInvitation — invitación de un usuario a una tienda con un rol.
 *
 * Flujo:
 *  1. Un usuario con permiso `team:invite` crea la invitación con email + role.
 *  2. El sistema genera un `token` random (64 chars hex) y lo envía por email.
 *  3. El invitado entra a /invitations/accept?token=... estando logueado.
 *     - Si su email coincide → crea el StoreAccess y marca `acceptedAt`.
 *     - Si su email no coincide → 403.
 *  4. Si nadie acepta antes de `expiresAt` (default 7 días), expira.
 *  5. Quien invitó puede revocar la invitación pendiente con DELETE.
 *
 * Una sola invitación pendiente por (email, storeId): si se reinvita con otro
 * rol, se actualiza la existente.
 */
const storeInvitationSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['admin', 'editor', 'viewer'],
      default: 'viewer',
      required: true,
    },
    permissions: { type: [String], default: [] },
    token: { type: String, required: true, unique: true, index: true },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date },
    acceptedByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    revokedAt: { type: Date },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired', 'revoked'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

storeInvitationSchema.index({ storeId: 1, email: 1, status: 1 });

storeInvitationSchema.statics.generateToken = function () {
  return crypto.randomBytes(32).toString('hex');
};

storeInvitationSchema.methods.isUsable = function () {
  return this.status === 'pending' && this.expiresAt > new Date();
};

module.exports = mongoose.model('StoreInvitation', storeInvitationSchema);
