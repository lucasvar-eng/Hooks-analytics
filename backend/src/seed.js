/**
 * Seed script — creates the first admin user.
 * Run once: node src/seed.js
 *
 * Env opcionales: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD. Si no hay password,
 * se genera una aleatoria y se imprime una sola vez.
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const { mongodbUri } = require('./config/environment');
const User = require('./models/User');

async function seed() {
  await mongoose.connect(mongodbUri);
  console.log('Connected to MongoDB');

  const email = process.env.SEED_ADMIN_EMAIL || 'admin@hooks.local';
  const existing = await User.findOne({ $or: [{ email }, { role: 'admin' }] });
  if (existing) {
    console.log('Ya existe un admin, skipping. Para sumar usuarios usá scripts/createUser.js');
    process.exit(0);
  }

  const password = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
  const admin = await User.create({
    email,
    password,
    nombre: 'Admin',
    role: 'admin',
  });

  console.log(`Admin user created: ${admin.email}`);
  console.log(`Password: ${password}`);
  console.log('Guardala ahora: no se vuelve a mostrar.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
