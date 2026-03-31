const papa = require('papaparse');
const Store = require('../models/Store');
const FixedCost = require('../models/FixedCost');
const { importProductCosts, getPnL, getBreakeven, getCostTemplate } = require('../services/costosService');
const { recalculateAllOrders } = require('../services/orderFinancials');
const logger = require('../utils/logger');

exports.uploadProductCosts = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const csv = req.file.buffer.toString('utf-8');
  const { data, errors } = papa.parse(csv, { header: true, skipEmptyLines: true });

  if (errors.length > 0) {
    return res.status(400).json({ error: 'CSV parse error', details: errors.slice(0, 5) });
  }

  const result = await importProductCosts(req.params.id, data, {
    createdBy: req.user?._id,
    source: 'csv',
    effectiveFrom: req.body?.effectiveFrom,
  });

  // Recalculate orders in background if costs changed
  if (result.updated > 0) {
    const store = await Store.findById(req.params.id);
    if (store) {
      recalculateAllOrders(store).catch((err) =>
        logger.error(`Background recalc failed: ${err.message}`)
      );
    }
  }

  res.json(result);
};

exports.downloadTemplate = (req, res) => {
  const type = req.query.type || 'productos';
  const content = getCostTemplate(type);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=plantilla_costos_${type}.csv`);
  res.send(content);
};

exports.updateCostos = async (req, res) => {
  const allowed = ['tasaIBB', 'feePlataformaPct', 'comisionPagoConfig', 'costosEnvio', 'costosAdicionales'];
  const update = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  }

  const store = await Store.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!store) return res.status(404).json({ error: 'Store not found' });

  // Background recalculate
  recalculateAllOrders(store).catch((err) =>
    logger.error(`Background recalc failed: ${err.message}`)
  );

  res.json({ message: 'Settings updated, recalculating orders...' });
};

exports.getPnL = async (req, res) => {
  const { from, to } = req.query;
  const pnl = await getPnL(req.params.id, from, to);
  res.json(pnl);
};

exports.getBreakeven = async (req, res) => {
  const { from, to } = req.query;
  const be = await getBreakeven(req.params.id, from, to);
  res.json(be);
};

exports.listFixedCosts = async (req, res) => {
  const items = await FixedCost.find({ storeId: req.params.id, active: true })
    .sort({ createdAt: -1 })
    .lean();
  res.json(items);
};

exports.createFixedCost = async (req, res) => {
  const item = await FixedCost.create({
    storeId: req.params.id,
    nombre: req.body.nombre,
    categoria: req.body.categoria,
    monto: req.body.monto,
    cadence: req.body.cadence || 'monthly',
    periodStart: req.body.periodStart,
    periodEnd: req.body.periodEnd,
    notes: req.body.notes,
    createdBy: req.user?._id,
  });
  res.status(201).json(item);
};

exports.deleteFixedCost = async (req, res) => {
  await FixedCost.findOneAndUpdate(
    { _id: req.params.fixedCostId, storeId: req.params.id },
    { $set: { active: false } }
  );
  res.json({ message: 'Fixed cost archived' });
};
