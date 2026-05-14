/**
 * storeConnections — service para tokens de integraciones, reemplaza la versión
 * anterior que guardaba en Store. Ahora vive en su propia collection
 * `StoreConnection`.
 *
 * API:
 *  - getConnection(storeId, provider, opts?)
 *  - getToken(storeId, provider)
 *  - setConnection(storeId, provider, { accessToken, refreshToken?, expiresAt?, scopes?, metadata?, connectedByUser?, status? })
 *  - clearConnection(storeId, provider)
 *  - listConnections(storeId)
 *  - markUsed(storeId, provider)
 *  - markError(storeId, provider, error)
 *  - findActiveStoresByProvider(provider) → ids con conexión activa (para crons)
 *
 * Provider canónico: 'tiendanube' | 'meta' | 'shopify' | 'google'.
 * Acepta también el alias corto 'tn' como sinónimo de 'tiendanube'.
 */
const mongoose = require('mongoose');
const StoreConnection = require('../models/StoreConnection');
const { encrypt, decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

const PROVIDER_ALIASES = {
  tn: 'tiendanube',
  tiendanube: 'tiendanube',
  meta: 'meta',
  shopify: 'shopify',
  google: 'google',
};

function normalizeProvider(provider) {
  const canonical = PROVIDER_ALIASES[provider];
  if (!canonical) {
    throw new Error(`Provider desconocido: ${provider}. Válidos: ${Object.keys(PROVIDER_ALIASES).join(', ')}`);
  }
  return canonical;
}

function toObjectId(storeId) {
  if (storeId instanceof mongoose.Types.ObjectId) return storeId;
  return new mongoose.Types.ObjectId(String(storeId));
}

/**
 * Carga el doc StoreConnection (con campos cifrados incluidos).
 * Retorna null si no existe.
 */
async function getConnection(storeId, provider, { includeRevoked = false } = {}) {
  const filter = { storeId: toObjectId(storeId), provider: normalizeProvider(provider) };
  if (!includeRevoked) filter.status = { $ne: 'revoked' };

  return StoreConnection.findOne(filter).select(
    '+accessTokenEncrypted +accessTokenIV +accessTokenAuthTag +refreshTokenEncrypted +refreshTokenIV +refreshTokenAuthTag',
  );
}

/**
 * Descifra y devuelve el access token. null si no existe la conexión o si
 * el descifrado falla.
 */
async function getToken(storeId, provider) {
  const conn = await getConnection(storeId, provider);
  if (!conn || !conn.accessTokenEncrypted) return null;
  try {
    return decrypt(conn.accessTokenEncrypted, conn.accessTokenIV, conn.accessTokenAuthTag);
  } catch (error) {
    logger.error(`Fallo descifrando ${provider} token para store ${storeId}: ${error.message}`);
    return null;
  }
}

/**
 * Crea o actualiza una conexión. `accessToken` es obligatorio.
 * Para borrar la conexión, usar clearConnection.
 */
async function setConnection(storeId, provider, {
  accessToken,
  refreshToken,
  expiresAt,
  scopes,
  metadata,
  connectedByUser,
  status,
} = {}) {
  if (!accessToken) throw new Error('accessToken es requerido');

  const canonicalProvider = normalizeProvider(provider);
  const enc = encrypt(accessToken);

  const update = {
    storeId: toObjectId(storeId),
    provider: canonicalProvider,
    accessTokenEncrypted: enc.encrypted,
    accessTokenIV: enc.iv,
    accessTokenAuthTag: enc.authTag,
    status: status || 'active',
    lastError: '',
  };

  if (refreshToken) {
    const rEnc = encrypt(refreshToken);
    update.refreshTokenEncrypted = rEnc.encrypted;
    update.refreshTokenIV = rEnc.iv;
    update.refreshTokenAuthTag = rEnc.authTag;
  }

  if (expiresAt !== undefined) update.expiresAt = expiresAt;
  if (Array.isArray(scopes)) update.scopes = scopes;
  if (metadata !== undefined) update.metadata = metadata;
  if (connectedByUser) update.connectedByUser = connectedByUser;

  // upsert: si ya existe (storeId+provider), refresca; sino crea.
  const existing = await StoreConnection.findOne({
    storeId: update.storeId,
    provider: canonicalProvider,
  });

  if (existing) {
    Object.assign(existing, update);
    if (!existing.connectedAt) existing.connectedAt = new Date();
    if (existing.status !== 'active' && update.status === 'active') {
      existing.connectedAt = new Date(); // reconnect
    }
    await existing.save();
    return existing;
  }

  return StoreConnection.create({
    ...update,
    connectedAt: new Date(),
  });
}

async function clearConnection(storeId, provider) {
  const canonical = normalizeProvider(provider);
  await StoreConnection.deleteOne({ storeId: toObjectId(storeId), provider: canonical });
}

async function listConnections(storeId, { includeRevoked = false } = {}) {
  const filter = { storeId: toObjectId(storeId) };
  if (!includeRevoked) filter.status = { $ne: 'revoked' };
  return StoreConnection.find(filter).sort({ provider: 1 });
}

async function markUsed(storeId, provider) {
  await StoreConnection.updateOne(
    { storeId: toObjectId(storeId), provider: normalizeProvider(provider) },
    { $set: { lastUsedAt: new Date(), lastError: '' } },
  );
}

async function markError(storeId, provider, errorMessage) {
  await StoreConnection.updateOne(
    { storeId: toObjectId(storeId), provider: normalizeProvider(provider) },
    { $set: { lastError: String(errorMessage || '').slice(0, 500) } },
  );
}

async function markStatus(storeId, provider, status) {
  await StoreConnection.updateOne(
    { storeId: toObjectId(storeId), provider: normalizeProvider(provider) },
    { $set: { status } },
  );
}

/**
 * Devuelve los storeIds que tienen una conexión activa para un provider.
 * Útil para crons.
 */
async function findActiveStoresByProvider(provider) {
  const canonical = normalizeProvider(provider);
  const conns = await StoreConnection.find({ provider: canonical, status: 'active' })
    .select('storeId')
    .lean();
  return conns.map((c) => c.storeId);
}

module.exports = {
  getConnection,
  getToken,
  setConnection,
  clearConnection,
  listConnections,
  markUsed,
  markError,
  markStatus,
  findActiveStoresByProvider,
  normalizeProvider,
};
