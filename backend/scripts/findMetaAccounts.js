const connectDB = require('../src/config/database');
const mongoose = require('mongoose');
const Store = require('../src/models/Store');
const metaAPI = require('../src/services/metaAPI');

async function main() {
  const storeName = process.argv[2] || 'MANGUZ';
  const pattern = new RegExp(process.argv[3] || 'pataforma|plataforma', 'i');

  await connectDB();
  const store = await Store.findOne({ nombre: storeName }).select('nombre metaAccessToken').lean();
  if (!store?.metaAccessToken) {
    throw new Error(`La tienda ${storeName} no tiene token Meta guardado`);
  }

  const accounts = await metaAPI.getAdAccounts(store.metaAccessToken);
  const matches = accounts.filter((account) => pattern.test(`${account.name || ''} ${account.id || ''}`));

  console.log(JSON.stringify({ store: store.nombre, total: accounts.length, matches }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.response?.data || error.message || error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
