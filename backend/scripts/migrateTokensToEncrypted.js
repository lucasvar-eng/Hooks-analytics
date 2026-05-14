#!/usr/bin/env node
/**
 * Migración one-shot: encriptar tokens legacy de Store (tnAccessToken,
 * metaAccessToken, shopifyAccessToken) → tnTokenEncrypted + IV + AuthTag, etc.
 *
 * Idempotente: ya migrado lo saltea. Después de correr, los campos legacy
 * quedan en undefined y los nuevos contienen el ciphertext.
 *
 * Uso:
 *   cd backend && node scripts/migrateTokensToEncrypted.js
 *   cd backend && node scripts/migrateTokensToEncrypted.js --dry-run
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const Store = require('../src/models/Store');
const { setStoreToken, getStoreToken, PROVIDERS } = require('../src/utils/tokenAccess');

const DRY = process.argv.includes('--dry-run');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI no configurada');
    process.exit(1);
  }
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
    console.error('ENCRYPTION_KEY no configurada o inválida (hex de 64 chars)');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  console.log(`\n=== Migración tokens → encriptados ${DRY ? '(DRY RUN)' : ''} ===\n`);

  const providers = Object.keys(PROVIDERS); // ['tn', 'meta', 'shopify']
  const stats = { migrated: 0, skipped: 0, errored: 0, alreadyEncrypted: 0 };

  for (const provider of providers) {
    const cfg = PROVIDERS[provider];

    // Cargar stores con CUALQUIER campo legacy/encriptado del provider
    const stores = await Store.find({})
      .select(`nombre +${cfg.legacyField} +${cfg.encField} +${cfg.ivField} +${cfg.authTagField}`);

    console.log(`\n--- ${provider} (${stores.length} stores) ---`);

    for (const store of stores) {
      const hasLegacy = !!store[cfg.legacyField];
      const hasEnc = !!(store[cfg.encField] && store[cfg.ivField] && store[cfg.authTagField]);

      if (!hasLegacy && !hasEnc) {
        // Nada que hacer, sin token
        continue;
      }

      if (hasEnc && !hasLegacy) {
        stats.alreadyEncrypted++;
        continue;
      }

      if (hasEnc && hasLegacy) {
        // Ya migrado pero quedó basura legacy: limpiar
        console.log(`  · ${store.nombre} — ya encriptado, limpiando residuo legacy`);
        if (!DRY) {
          store[cfg.legacyField] = undefined;
          await store.save();
        }
        stats.migrated++;
        continue;
      }

      // hasLegacy && !hasEnc → caso principal a migrar
      try {
        const legacyToken = store[cfg.legacyField];
        if (DRY) {
          console.log(`  · [DRY] ${store.nombre} — encriptaría token (${legacyToken.length} chars)`);
        } else {
          setStoreToken(store, provider, legacyToken);
          // Validar round-trip antes de guardar
          const roundTrip = getStoreToken(store, provider);
          if (roundTrip !== legacyToken) {
            throw new Error('Round-trip de encrypt/decrypt no coincide');
          }
          await store.save();
          console.log(`  ✓ ${store.nombre}`);
        }
        stats.migrated++;
      } catch (error) {
        console.error(`  ✗ ${store.nombre} — error: ${error.message}`);
        stats.errored++;
      }
    }
  }

  console.log('\n=== Resumen ===');
  console.log(`Migrados:           ${stats.migrated}`);
  console.log(`Ya encriptados:     ${stats.alreadyEncrypted}`);
  console.log(`Errores:            ${stats.errored}`);
  if (DRY) console.log('\n[DRY RUN] Ningún cambio fue persistido.');

  await mongoose.disconnect();
  process.exit(stats.errored > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Migración falló:', err);
  process.exit(1);
});
