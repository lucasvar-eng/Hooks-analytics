const mongoose = require('mongoose');

/**
 * StoreConnection — credenciales encriptadas de una integración de una tienda.
 *
 * Reemplaza los campos `tnAccessToken / metaAccessToken / shopifyAccessToken`
 * que vivían en `Store`. Beneficios:
 *
 *  - Separa la entidad "tienda" (info + config) de la entidad "credencial"
 *    (token + refresh + scopes). Esto permite que un usuario con `viewer`
 *    access vea métricas pero no acceda al token.
 *  - Permite múltiples cuentas del mismo provider por store en el futuro
 *    (ej: 2 cuentas Meta en la misma tienda).
 *  - Loggea quién hizo el OAuth (`connectedByUser`), cuándo, last refresh,
 *    last error.
 *
 * Tokens encriptados con AES-256-GCM. Campos sensibles con select:false.
 */
const storeConnectionSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    provider: { type: String, enum: ['tiendanube', 'meta', 'shopify', 'google'], required: true },

    // Access token (encriptado AES-256-GCM)
    accessTokenEncrypted: { type: String, select: false, required: true },
    accessTokenIV: { type: String, select: false, required: true },
    accessTokenAuthTag: { type: String, select: false, required: true },

    // Refresh token (opcional, mismo cifrado)
    refreshTokenEncrypted: { type: String, select: false },
    refreshTokenIV: { type: String, select: false },
    refreshTokenAuthTag: { type: String, select: false },

    // Vencimiento del access token (si el provider lo expone)
    expiresAt: { type: Date },

    // Scopes que dio el OAuth
    scopes: [{ type: String }],

    // Metadata no sensible (IDs externos, dominios, etc.) — la app la consume libre.
    // Ej. para meta: { adAccountId, businessAccountId, pageId, pixelId }
    //     para tn:   { tnStoreId, tnNombre, tokenSource: 'manual'|'cro_service'|'oauth' }
    //     para shopify: { shopDomain, shopName, shopId }
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Auditoría
    connectedByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    connectedAt: { type: Date, default: Date.now },
    lastRefreshAt: { type: Date },
    lastUsedAt: { type: Date }, // cada sync exitoso lo actualiza
    lastError: { type: String, default: '' },

    // Estado: active / expired / revoked. Si un sync da 401, marcar expired.
    status: { type: String, enum: ['active', 'expired', 'revoked'], default: 'active' },
  },
  { timestamps: true }
);

// Una conexión activa por (storeId, provider) — para 2 cuentas habría que
// agregar un suffix o eliminar este unique. Por ahora alineado con el modelo
// que ya teníamos en Store.
storeConnectionSchema.index({ storeId: 1, provider: 1, status: 1 });

// Defensa en profundidad: aunque alguien haga .select('+token'), toJSON tira
// los campos sensibles antes de serializar.
const SENSITIVE_FIELDS = [
  'accessTokenEncrypted', 'accessTokenIV', 'accessTokenAuthTag',
  'refreshTokenEncrypted', 'refreshTokenIV', 'refreshTokenAuthTag',
];
storeConnectionSchema.methods.toJSON = function () {
  const obj = this.toObject();
  for (const f of SENSITIVE_FIELDS) delete obj[f];
  return obj;
};

module.exports = mongoose.model('StoreConnection', storeConnectionSchema);
