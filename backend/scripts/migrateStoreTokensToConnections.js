#!/usr/bin/env node
/**
 * Migración: Store.tnTokenEncrypted/metaTokenEncrypted/shopifyTokenEncrypted (+ legacy)
 *           → StoreConnection docs.
 *
 * Pasos:
 *  1. Por cada Store, para cada provider (tn/meta/shopify):
 *     - Lee el token (encrypted si existe, sino legacy plaintext).
 *     - Crea/actualiza StoreConnection con ese token + metadata del store
 *       (tnStoreId, metaAdAccountId/metaAdAccounts/metaTokenExpiresAt,
 *        shopifyShopDomain/shopifyShopId, etc.).
 *     - Encripta de nuevo en la StoreConnection (la lógica vive ahí).
 *  2. NO borra los campos del Store todavía — un commit posterior cleanup
 *     (después de validar en runtime que todo funciona via StoreConnection).
 *
 * Idempotente: si ya existe una StoreConnection (storeId, provider), update.
 *
 * Uso:
 *   cd backend && node scripts/migrateStoreTokensToConnections.js
 *   cd backend && node scripts/migrateStoreTokensToConnections.js --dry-run
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Store = require('../src/models/Store');
const { setConnection, getConnection } = require('../src/services/storeConnections');
const { decrypt } = require('../src/utils/encryption');

const DRY = process.argv.includes('--dry-run');

const PROVIDER_FIELDS = {
  tiendanube: {
    legacy: 'tnAccessToken',
    enc: 'tnTokenEncrypted',
    iv: 'tnTokenIV',
    authTag: 'tnTokenAuthTag',
    metadataFn: (s) => ({
      tnStoreId: s.tnStoreId,
      tnNombre: s.tnNombre,
      tokenSource: s.tnTokenSource || 'manual',
    }),
  },
  meta: {
    legacy: 'metaAccessToken',
    enc: 'metaTokenEncrypted',
    iv: 'metaTokenIV',
    authTag: 'metaTokenAuthTag',
    metadataFn: (s) => ({
      adAccountId: s.metaAdAccountId,
      adAccounts: s.metaAdAccounts || [],
      pageId: s.metaPageId,
      pixelId: s.metaPixelId,
      businessAccountId: s.metaBusinessAccountId,
    }),
    expiresAtFn: (s) => s.metaTokenExpiresAt,
  },
  shopify: {
    legacy: 'shopifyAccessToken',
    enc: 'shopifyTokenEncrypted',
    iv: 'shopifyTokenIV',
    authTag: 'shopifyTokenAuthTag',
    metadataFn: (s) => ({
      shopDomain: s.shopifyShopDomain,
      shopName: s.shopifyShopName,
      shopId: s.shopifyShopId,
    }),
  },
};

function extractToken(store, cfg) {
  if (store[cfg.enc] && store[cfg.iv] && store[cfg.authTag]) {
    try {
      return decrypt(store[cfg.enc], store[cfg.iv], store[cfg.authTag]);
    } catch (e) {
      console.warn(`  [warn] No pude descifrar token de ${cfg.enc} en store ${store.nombre}: ${e.message}`);
    }
  }
  if (store[cfg.legacy]) return store[cfg.legacy];
  return null;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI no configurada');
    process.exit(1);
  }
  if (!process.env.ENCRYPTION_KEY) {
    console.error('ENCRYPTION_KEY no configurada');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  console.log(`\n=== Migración Store.tokens → StoreConnection ${DRY ? '(DRY RUN)' : ''} ===\n`);

  // Cargar TODOS los stores con TODOS los fields sensibles
  const stores = await Store.find({}).select(
    '+tnAccessToken +tnTokenEncrypted +tnTokenIV +tnTokenAuthTag ' +
    '+metaAccessToken +metaTokenEncrypted +metaTokenIV +metaTokenAuthTag ' +
    '+shopifyAccessToken +shopifyTokenEncrypted +shopifyTokenIV +shopifyTokenAuthTag'
  );

  const stats = { created: 0, updated: 0, skipped: 0, errored: 0 };

  for (const store of stores) {
    for (const [provider, cfg] of Object.entries(PROVIDER_FIELDS)) {
      const token = extractToken(store, cfg);
      if (!token) continue;

      const metadata = cfg.metadataFn(store);
      const expiresAt = cfg.expiresAtFn ? cfg.expiresAtFn(store) : undefined;

      try {
        const existing = await getConnection(store._id, provider, { includeRevoked: true });

        if (DRY) {
          console.log(`  [DRY] ${store.nombre} · ${provider} · ${existing ? 'UPDATE' : 'CREATE'} · token ${token.length} chars`);
          existing ? stats.updated++ : stats.created++;
          continue;
        }

        await setConnection(store._id, provider, {
          accessToken: token,
          expiresAt,
          metadata,
          status: 'active',
        });

        console.log(`  ✓ ${store.nombre} · ${provider} · ${existing ? 'actualizado' : 'creado'}`);
        existing ? stats.updated++ : stats.created++;
      } catch (error) {
        console.error(`  ✗ ${store.nombre} · ${provider} · ${error.message}`);
        stats.errored++;
      }
    }
  }

  console.log('\n=== Resumen ===');
  console.log(`Creados:    ${stats.created}`);
  console.log(`Actualizados: ${stats.updated}`);
  console.log(`Errores:    ${stats.errored}`);
  if (DRY) console.log('\n[DRY RUN] Ningún cambio fue persistido.');
  else console.log('\nLos campos legacy del Store NO se borraron — eso se hace después de validar runtime.');

  await mongoose.disconnect();
  process.exit(stats.errored > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Migración falló:', err);
  process.exit(1);
});
