#!/usr/bin/env node
/**
 * Migración: User.storeAccess[] (array de Store ObjectIds) → StoreAccess docs.
 *
 * - Cada (user, store) en el array existente se convierte en un doc con
 *   role 'admin' por defecto (mantiene compatibilidad: hoy todos podían
 *   editar lo que tenían en su lista).
 * - El primer User con un store en su lista pasa a `owner` si no hay
 *   nadie owner todavía. Si hay múltiples, los demás quedan admin.
 * - Idempotente: si ya existe StoreAccess para (user, store), no la pisa.
 *
 * NO borra User.storeAccess[] todavía; eso queda para un cleanup posterior
 * después de validar runtime de los endpoints.
 *
 * Uso:
 *   cd backend && node scripts/migrateUserStoreAccessToAcl.js --dry-run
 *   cd backend && node scripts/migrateUserStoreAccessToAcl.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../src/models/User');
const Store = require('../src/models/Store');
const StoreAccess = require('../src/models/StoreAccess');

const DRY = process.argv.includes('--dry-run');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI no configurada');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  console.log(`\n=== Migración User.storeAccess[] → StoreAccess ${DRY ? '(DRY RUN)' : ''} ===\n`);

  const users = await User.find({}).select('email nombre role storeAccess createdAt').lean();
  const stores = await Store.find({}).select('_id nombre').lean();
  const storeById = new Map(stores.map((s) => [String(s._id), s]));

  const stats = { created: 0, skipped: 0, missingStore: 0, owners: 0 };
  const ownerByStore = new Map(); // storeId → userId del primer owner

  // Pre-cargar accesos ya existentes para idempotencia
  const existing = await StoreAccess.find({}).select('userId storeId role').lean();
  const existingKey = new Set(existing.map((a) => `${a.userId}:${a.storeId}`));
  for (const a of existing) {
    if (a.role === 'owner') ownerByStore.set(String(a.storeId), String(a.userId));
  }

  // Sort users por createdAt ascendente → el más antiguo es candidato a owner
  users.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  for (const user of users) {
    const accesses = user.storeAccess || [];
    for (const storeId of accesses) {
      const sid = String(storeId);
      const key = `${user._id}:${sid}`;
      if (existingKey.has(key)) {
        stats.skipped++;
        continue;
      }
      if (!storeById.has(sid)) {
        console.warn(`  [warn] ${user.email} tiene acceso a un Store inexistente: ${sid}`);
        stats.missingStore++;
        continue;
      }

      let role = 'admin';
      if (!ownerByStore.has(sid)) {
        role = 'owner';
        ownerByStore.set(sid, String(user._id));
        stats.owners++;
      }

      const storeName = storeById.get(sid).nombre;
      console.log(`  ${DRY ? '[DRY]' : '✓'} ${user.email} · ${storeName} · ${role}`);

      if (!DRY) {
        await StoreAccess.create({
          userId: user._id,
          storeId,
          role,
          permissions: [],
          invitedBy: null,
          acceptedAt: new Date(),
        });
      }

      stats.created++;
      existingKey.add(key);
    }
  }

  console.log('\n=== Resumen ===');
  console.log(`Accesos creados:        ${stats.created} (${stats.owners} owners + ${stats.created - stats.owners} admins)`);
  console.log(`Saltados (ya existían): ${stats.skipped}`);
  console.log(`Store inexistente:      ${stats.missingStore}`);
  if (DRY) console.log('\n[DRY RUN] Ningún cambio fue persistido.');
  else console.log('\nUser.storeAccess[] NO se borró — eso se hace después de validar runtime.');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Migración falló:', err);
  process.exit(1);
});
