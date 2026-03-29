/**
 * Seed script — creates the first admin user.
 * Run once: node src/seed.js
 */
const mongoose = require('mongoose');
const { mongodbUri } = require('./config/environment');
const User = require('./models/User');

async function seed() {
  await mongoose.connect(mongodbUri);
  console.log('Connected to MongoDB');

  const existing = await User.findOne({ email: 'lucas@hooks.com.ar' });
  if (existing) {
    console.log('Admin user already exists, skipping.');
    process.exit(0);
  }

  const admin = await User.create({
    email: 'lucas@hooks.com.ar',
    password: 'hooks2026',
    nombre: 'Lucas',
    role: 'admin',
  });

  console.log(`Admin user created: ${admin.email}`);
  console.log('Login with: lucas@hooks.com.ar / hooks2026');
  console.log('IMPORTANT: Change this password after first login!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
