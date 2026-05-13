const connectDB = require('../src/config/database');
const mongoose = require('mongoose');
const Store = require('../src/models/Store');
const Report = require('../src/models/Report');
const { buildTemplateReport } = require('../src/services/reportTemplateService');

async function main() {
  const from = process.argv[2] || '2026-03-01';
  const to = process.argv[3] || '2026-03-31';
  const storeNames = process.argv.slice(4);
  const names = storeNames.length ? storeNames : ['MANGUZ', 'Limite Deportes'];

  await connectDB();

  const stores = (await Store.find({}).select('_id nombre').lean()).filter((store) => names.includes(store.nombre));
  const updated = [];

  for (const store of stores) {
    for (const templateKey of ['executive', 'meta-performance', 'creative-framework']) {
      const built = await buildTemplateReport(templateKey, String(store._id), from, to, null);

      const report = await Report.findOneAndUpdate(
        { storeId: store._id, titulo: built.titulo },
        {
          $set: {
            contenido: built.contenido,
            summary: built.summary,
            section: built.section,
            tipo: built.tipo,
            dateRange: { from: new Date(from), to: new Date(to) },
            snapshot: built.snapshot,
            confidence: built.confidence,
            qualityNote: built.qualityNote,
            generationMode: built.generationMode || 'manual',
            provider: built.provider || null,
            model: built.model || null,
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );

      updated.push({
        store: store.nombre,
        templateKey,
        title: report.titulo,
      });
    }
  }

  console.log(JSON.stringify({ stores: stores.map((s) => s.nombre), updated }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
