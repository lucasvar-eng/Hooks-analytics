#!/usr/bin/env node
/**
 * Cleanup: borra los campos legacy de token en Store (tnAccessToken,
 * tnTokenEncrypted/IV/AuthTag, idem meta y shopify).
 *
 * Pre-requisito: haber corrido migrateStoreTokensToConnections.js para que
 * todos los tokens vivan en StoreConnection. El script verifica que cada
 * Store con campos legacy tenga su StoreConnection equivalente antes de
 * borrar; si no, aborta para evitar pérdida de credenciales.
 *
 * Uso:
 *   cd backend && node scripts/cleanupLegacyTokenFields.js --dry-run
 *   cd backend && node scripts/cleanupLegacyTokenFields.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Store = require('../src/models/Store');
const StoreConnection = require('../src/models/StoreConnection');

const DRY = process.argv.includes('--dry-run');

const LEGACY_FIELDS = [
  'tnAccessToken',
  'tnTokenEncrypted',
  'tnTokenIV',
  'tnTokenAuthTag',
  'metaAccessToken',
  'metaTokenEncrypted',
  'metaTokenIV',
  'metaTokenAuthTag',
  'shopifyAccessToken',
  'shopifyTokenEncrypted',
  'shopifyTokenIV',
  'shopifyTokenAuthTag',
];

const PROVIDER_BY_PREFIX = {
  tn: 'tiendanube',
  meta: 'meta',
  shopify: 'shopify',
};

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI no configurada');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  console.log(`\n=== Cleanup legacy token fields ${DRY ? '(DRY RUN)' : ''} ===\n`);

  const stores = await Store.find({}).select(
    LEGACY_FIELDS.map((f) => `+${f}`).join(' ')
  );

  let blocked = 0;
  const toClean = [];

  for (const store of stores) {
    const tokensFound = new Set();
    for (const field of LEGACY_FIELDS) {
      if (store[field]) {
        const prefix = field.startsWith('tn') ? 'tn' : field.startsWith('meta') ? 'meta' : 'shopify';
        tokensFound.add(PROVIDER_BY_PREFIX[prefix]);
      }
    }

    if (tokensFound.size === 0) continue;

    // Para cada provider con datos legacy, verificar que existe StoreConnection
    let safe = true;
    for (const provider of tokensFound) {
      const conn = await StoreConnection.findOne({
        storeId: store._id,
        provider,
        status: 'active',
      });
      if (!conn) {
        console.warn(
          `  [BLOCK] ${store.nombre} tiene campos legacy de ${provider} pero NO existe StoreConnection. ` +
          'Corré migrateStoreTokensToConnections.js primero.'
        );
        safe = false;
        blocked++;
      }
    }

    if (safe) {
      toClean.push(store);
      console.log(`  [OK] ${store.nombre} listo para cleanup (providers: ${[...tokensFound].join(', ')})`);
    }
  }

  if (blocked > 0) {
    console.error(`\n${blocked} stores bloqueados. Abortando.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (DRY) {
    console.log(`\n[DRY RUN] Se limpiarían campos legacy en ${toClean.length} stores.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const unsetPayload = LEGACY_FIELDS.reduce((acc, f) => {
    acc[f] = '';
    return acc;
  }, {});

  const result = await Store.updateMany(
    { _id: { $in: toClean.map((s) => s._id) } },
    { $unset: unsetPayload }
  );

  console.log(`\n=== Resumen ===`);
  console.log(`Stores actualizados: ${result.modifiedCount}/${toClean.length}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Cleanup falló:', err);
  process.exit(1);
});
