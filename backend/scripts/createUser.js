#!/usr/bin/env node
/**
 * Crea un usuario directo en Mongo Atlas.
 *
 * Uso:
 *   cd backend
 *   node scripts/createUser.js \
 *     --email valentina@ejemplo.com \
 *     --name "Valentina" \
 *     --password "valentina2026" \
 *     --role analyst \
 *     --notification-email valentina@ejemplo.com
 *
 * Roles válidos (globales): admin | analyst | viewer
 *   - admin   → bypass total, acceso a todas las tiendas
 *   - analyst → permisos por tienda (vía StoreAccess)
 *   - viewer  → solo lectura (vía StoreAccess)
 *
 * Si el email ya existe, sale con error sin tocarlo.
 * El password se hashea con bcrypt (igual que la app).
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../src/models/User');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = (args.email || '').toLowerCase().trim();
  const name = args.name || '';
  const password = args.password || '';
  const role = args.role || 'viewer';
  const notificationEmail = args['notification-email'] || '';

  if (!email || !name || !password) {
    console.error('Faltan argumentos requeridos: --email --name --password');
    console.error('Uso: node scripts/createUser.js --email X --name "Nombre" --password "pass" [--role admin|analyst|viewer] [--notification-email X]');
    process.exit(1);
  }
  if (!['admin', 'analyst', 'viewer'].includes(role)) {
    console.error(`Rol inválido: ${role}. Use admin | analyst | viewer.`);
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('Password debe tener al menos 6 caracteres.');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI no está configurada en el .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      console.error(`\n❌ Ya existe un usuario con email "${email}".`);
      console.error(`   ID: ${existing._id} · rol actual: ${existing.role}\n`);
      process.exit(1);
    }

    const user = await User.create({
      email,
      password, // hook pre-save de User hace bcrypt.hash
      nombre: name,
      role,
      isActive: true,
      notificationEmail: notificationEmail || '',
      notificationPreferences: {
        alerts: { enabled: true, channels: ['email'], minSeverity: 'warning' },
        digests: { daily: false, weekly: true },
        reports: { onPublish: true },
      },
    });

    console.log(`\n✓ Usuario creado:`);
    console.log(`   ID:                  ${user._id}`);
    console.log(`   Email:               ${user.email}`);
    console.log(`   Nombre:              ${user.nombre}`);
    console.log(`   Rol global:          ${user.role}`);
    console.log(`   Notification email:  ${user.notificationEmail || '(usa email de login)'}`);
    console.log(`   Activo:              ${user.isActive}`);
    console.log(`\nPróximo paso recomendado:`);
    console.log(`   - Compartile al user su email + password por privado.`);
    console.log(`   - Cuando entre, que vaya a /profile y configure su API key de Resend para recibir alertas.`);
    console.log(`   - Si querés darle acceso a tiendas específicas, andá a /admin/users y editá su storeAccess.\n`);
  } catch (err) {
    console.error(`\n❌ Error creando user: ${err.message}\n`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
