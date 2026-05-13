const connectDB = require('../src/config/database');
const mongoose = require('mongoose');
const Store = require('../src/models/Store');
const { recalculateDailyMetric } = require('../src/services/metricCalculator');
const { addDaysToLabel } = require('../src/utils/businessDate');

async function main() {
  const [, , storeName, from, to] = process.argv;
  if (!storeName || !from || !to) {
    throw new Error('Uso: node ./scripts/recalcStoreRange.js "Nombre tienda" YYYY-MM-DD YYYY-MM-DD');
  }

  await connectDB();
  const store = await Store.findOne({ nombre: storeName });
  if (!store) throw new Error(`Store not found: ${storeName}`);

  let current = from;
  let processed = 0;
  while (current <= to) {
    await recalculateDailyMetric(store._id, current);
    processed++;
    current = addDaysToLabel(current, 1);
  }

  console.log(JSON.stringify({
    ok: true,
    store: store.nombre,
    from,
    to,
    processed,
  }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // noop
  }
  process.exit(1);
});
