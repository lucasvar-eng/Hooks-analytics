const Widget = require('../models/Widget');

const DEFAULT_DASHBOARD = [
  // Row 1: Main KPIs (8 small cards)
  { type: 'separator', title: 'KPIs Principales', size: 'full', config: {} },
  { type: 'kpi', title: 'Órdenes', size: 'sm', config: { metricKey: 'ordenesPositivas', prefix: '', suffix: '', decimals: 0 } },
  { type: 'kpi', title: 'Revenue', size: 'sm', config: { metricKey: 'revenue', prefix: '$', suffix: '', decimals: 0, compact: true } },
  { type: 'kpi', title: 'Ad Spend', size: 'sm', config: { metricKey: 'adSpend', prefix: '$', suffix: '', decimals: 0, compact: true } },
  { type: 'kpi', title: 'Profit', size: 'sm', config: { metricKey: 'profit', prefix: '$', suffix: '', decimals: 0, compact: true } },
  { type: 'kpi', title: 'Margen %', size: 'sm', config: { metricKey: 'profitMargin', prefix: '', suffix: '%', decimals: 1, targetKey: 'profitMarginMin' } },
  { type: 'kpi', title: 'ROAS', size: 'sm', config: { metricKey: 'roas', prefix: '', suffix: 'x', decimals: 2, targetKey: 'roasTarget' } },
  { type: 'kpi', title: 'True ROAS', size: 'sm', config: { metricKey: 'trueRoas', prefix: '', suffix: 'x', decimals: 2, targetKey: 'trueRoasTarget' } },
  { type: 'kpi', title: 'CPA', size: 'sm', config: { metricKey: 'cpa', prefix: '$', suffix: '', decimals: 0, targetKey: 'cpaMaximo', inverse: true } },

  // Row 2: Tienda group + NC/RC group
  { type: 'kpi-group', title: 'Tienda', size: 'md', config: { metrics: [
    { key: 'ordenesPositivas', label: 'Órdenes totales', prefix: '', suffix: '', decimals: 0 },
    { key: 'ordenesPositivas', label: 'Órdenes >$0', prefix: '', suffix: '', decimals: 0 },
    { key: 'revenue', label: 'Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
    { key: 'netRevenue', label: 'Net Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
    { key: 'aov', label: 'AOV', prefix: '$', suffix: '', decimals: 0 },
    { key: 'aovNeto', label: 'AOV Neto', prefix: '$', suffix: '', decimals: 0 },
    { key: 'devoluciones', label: 'Devoluciones', prefix: '', suffix: '', decimals: 0 },
  ] } },
  { type: 'kpi-group', title: 'Clientes Nuevos vs Recurrentes', size: 'md', config: { metrics: [
    { key: 'ncPct', label: 'NC %', prefix: '', suffix: '%', decimals: 1 },
    { key: 'ncOrdenes', label: 'NC Órdenes', prefix: '', suffix: '', decimals: 0 },
    { key: 'ncRevenue', label: 'NC Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
    { key: 'ncCpa', label: 'NC CPA', prefix: '$', suffix: '', decimals: 0 },
    { key: 'ncRoas', label: 'NC ROAS', prefix: '', suffix: 'x', decimals: 2 },
    { key: 'rcOrdenes', label: 'RC Órdenes', prefix: '', suffix: '', decimals: 0 },
    { key: 'rcRevenue', label: 'RC Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
  ] } },

  // Row 3: Costos
  { type: 'kpi-group', title: 'Costos', size: 'full', config: { metrics: [
    { key: 'totalCostoProductos', label: 'COGS', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalCostoEnvio', label: 'Costo Envío', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalComisionPago', label: 'Comisión Pago', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalComisionCuotas', label: 'Comisión Cuotas', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalImpuestosIBB', label: 'IBB', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalFeePlataforma', label: 'Fee Plataforma', prefix: '$', suffix: '', decimals: 0 },
  ] } },

  // Row 4: Latest sales
  { type: 'table', title: 'Últimas Ventas', size: 'full', config: { dataSource: 'latest-sales' } },
];

exports.list = async (req, res, next) => {
  try {
    const { pageId } = req.query;
    const filter = { storeId: req.params.id };
    if (pageId) filter.pageId = pageId;

    const widgets = await Widget.find(filter).sort({ order: 1 }).lean();
    res.json(widgets);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { type, title, config, pageId, order, size } = req.body;
    if (!type || !title) return res.status(400).json({ error: 'type and title required' });

    const count = await Widget.countDocuments({ storeId: req.params.id, pageId: pageId || 'dashboard' });

    const widget = await Widget.create({
      storeId: req.params.id,
      pageId: pageId || 'dashboard',
      type,
      title,
      size: size || 'sm',
      config: config || {},
      order: order ?? count,
    });

    res.status(201).json(widget);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { title, config, order, size, type } = req.body;
    const update = {};
    if (title !== undefined) update.title = title;
    if (config !== undefined) update.config = config;
    if (order !== undefined) update.order = order;
    if (size !== undefined) update.size = size;
    if (type !== undefined) update.type = type;

    const widget = await Widget.findOneAndUpdate(
      { _id: req.params.widgetId, storeId: req.params.id },
      update,
      { new: true }
    );
    if (!widget) return res.status(404).json({ error: 'Widget not found' });
    res.json(widget);
  } catch (error) {
    next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await Widget.findOneAndDelete({ _id: req.params.widgetId, storeId: req.params.id });
    res.json({ message: 'Deleted' });
  } catch (error) {
    next(error);
  }
};

exports.reorder = async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });

    const ops = items.map((item) => ({
      updateOne: {
        filter: { _id: item._id, storeId: req.params.id },
        update: { $set: { order: item.order } },
      },
    }));

    await Widget.bulkWrite(ops);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// Seed default widgets for a store's dashboard
exports.seedDefaults = async (req, res, next) => {
  try {
    const storeId = req.params.id;
    const pageId = req.body.pageId || 'dashboard';

    // Only seed if no widgets exist
    const existing = await Widget.countDocuments({ storeId, pageId });
    if (existing > 0) {
      return res.json({ message: 'Already has widgets', count: existing });
    }

    const docs = DEFAULT_DASHBOARD.map((w, i) => ({
      storeId,
      pageId,
      type: w.type,
      title: w.title,
      size: w.size,
      config: w.config,
      order: i,
    }));

    await Widget.insertMany(docs);
    const widgets = await Widget.find({ storeId, pageId }).sort({ order: 1 }).lean();
    res.status(201).json(widgets);
  } catch (error) {
    next(error);
  }
};

// Reset dashboard to defaults
exports.resetDefaults = async (req, res, next) => {
  try {
    const storeId = req.params.id;
    const pageId = req.body.pageId || 'dashboard';

    await Widget.deleteMany({ storeId, pageId });

    const docs = DEFAULT_DASHBOARD.map((w, i) => ({
      storeId,
      pageId,
      type: w.type,
      title: w.title,
      size: w.size,
      config: w.config,
      order: i,
    }));

    await Widget.insertMany(docs);
    const widgets = await Widget.find({ storeId, pageId }).sort({ order: 1 }).lean();
    res.json(widgets);
  } catch (error) {
    next(error);
  }
};
