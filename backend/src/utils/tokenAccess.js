/**
 * tokenAccess — helper para guardar y leer tokens de integraciones encriptados.
 *
 * Hasta ahora los tokens de TN/Meta/Shopify estaban en plaintext en Mongo
 * (`Store.tnAccessToken`, `Store.metaAccessToken`, `Store.shopifyAccessToken`).
 * Ahora se guardan en campos `<provider>TokenEncrypted` + `<provider>TokenIV` +
 * `<provider>TokenAuthTag` con `select: false`, usando AES-256-GCM.
 *
 * API:
 *   - getStoreToken(storeDoc, provider) → string | null     (descifra y devuelve)
 *   - setStoreToken(storeDoc, provider, token)              (encripta + asigna)
 *   - clearStoreToken(storeDoc, provider)
 *   - loadStoreWithToken(storeId, provider)                 (find + .select() de los hidden fields)
 *
 * provider ∈ 'tn' | 'meta' | 'shopify'
 */
const { encrypt, decrypt } = require('./encryption');
const logger = require('./logger');

const PROVIDERS = {
  tn: {
    legacyField: 'tnAccessToken',
    encField: 'tnTokenEncrypted',
    ivField: 'tnTokenIV',
    authTagField: 'tnTokenAuthTag',
  },
  meta: {
    legacyField: 'metaAccessToken',
    encField: 'metaTokenEncrypted',
    ivField: 'metaTokenIV',
    authTagField: 'metaTokenAuthTag',
  },
  shopify: {
    legacyField: 'shopifyAccessToken',
    encField: 'shopifyTokenEncrypted',
    ivField: 'shopifyTokenIV',
    authTagField: 'shopifyTokenAuthTag',
  },
};

function getProviderConfig(provider) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error(`Provider desconocido: ${provider}. Válidos: ${Object.keys(PROVIDERS).join(', ')}`);
  return cfg;
}

/**
 * Lee un token de un store doc. Prioridad:
 *   1. Campo encriptado nuevo (si existe, descifra y devuelve)
 *   2. Campo legacy en plaintext (fallback durante migración)
 *
 * Si el doc llega sin los campos encriptados (porque no se hizo select+), devuelve null.
 * Para asegurar lectura, usar loadStoreWithToken(storeId, provider).
 */
function getStoreToken(storeDoc, provider) {
  if (!storeDoc) return null;
  const cfg = getProviderConfig(provider);
  const encrypted = storeDoc[cfg.encField];
  const iv = storeDoc[cfg.ivField];
  const authTag = storeDoc[cfg.authTagField];

  if (encrypted && iv && authTag) {
    try {
      return decrypt(encrypted, iv, authTag);
    } catch (error) {
      logger.error(`Fallo descifrando token ${provider} para store ${storeDoc._id}: ${error.message}`);
      return null;
    }
  }

  // Fallback legacy durante migración — log para detectar pendientes
  if (storeDoc[cfg.legacyField]) {
    logger.warn(`Token legacy en plaintext detectado: store=${storeDoc._id} provider=${provider}. Correr migración de cifrado.`);
    return storeDoc[cfg.legacyField];
  }

  return null;
}

/**
 * Asigna un token a un store doc (encriptado). No hace save automático — el caller
 * debe llamar .save().
 *
 * Si el token es null/undefined/empty → limpia los campos (mismo efecto que clearStoreToken).
 */
function setStoreToken(storeDoc, provider, token) {
  const cfg = getProviderConfig(provider);

  if (!token) {
    storeDoc[cfg.encField] = undefined;
    storeDoc[cfg.ivField] = undefined;
    storeDoc[cfg.authTagField] = undefined;
    storeDoc[cfg.legacyField] = undefined;
    return;
  }

  const { encrypted, iv, authTag } = encrypt(token);
  storeDoc[cfg.encField] = encrypted;
  storeDoc[cfg.ivField] = iv;
  storeDoc[cfg.authTagField] = authTag;
  // Borrar legacy si existía
  storeDoc[cfg.legacyField] = undefined;
}

function clearStoreToken(storeDoc, provider) {
  setStoreToken(storeDoc, provider, null);
}

/**
 * Carga un Store con todos los campos necesarios para leer un token específico.
 * Los services de sync deben usar esto.
 */
async function loadStoreWithToken(Store, storeId, provider) {
  const cfg = getProviderConfig(provider);
  return Store.findById(storeId).select(`+${cfg.encField} +${cfg.ivField} +${cfg.authTagField} +${cfg.legacyField}`);
}

/**
 * Carga TODOS los stores con tokens del provider — útil para crons y migraciones.
 */
async function findStoresWithToken(Store, provider, extraFilter = {}) {
  const cfg = getProviderConfig(provider);
  return Store.find(extraFilter).select(`+${cfg.encField} +${cfg.ivField} +${cfg.authTagField} +${cfg.legacyField}`);
}

module.exports = {
  getStoreToken,
  setStoreToken,
  clearStoreToken,
  loadStoreWithToken,
  findStoresWithToken,
  PROVIDERS,
};
