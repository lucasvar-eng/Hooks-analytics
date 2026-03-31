const Widget = require('../models/Widget');

const DEFAULT_DASHBOARD = [
  { type: 'separator', title: 'Salud ejecutiva', size: 'full', config: {} },
  { type: 'kpi', title: 'Órdenes', size: 'sm', config: { metricKey: 'ordenesPositivas', prefix: '', suffix: '', decimals: 0 } },
  { type: 'kpi', title: 'Ingresos', size: 'sm', config: { metricKey: 'revenue', metricLabel: 'Ingresos', prefix: '$', suffix: '', decimals: 0, compact: true } },
  { type: 'kpi', title: 'Ad Spend', size: 'sm', config: { metricKey: 'adSpend', prefix: '$', suffix: '', decimals: 0, compact: true } },
  { type: 'kpi', title: 'Ganancia', size: 'sm', config: { metricKey: 'profit', metricLabel: 'Ganancia', prefix: '$', suffix: '', decimals: 0, compact: true } },
  { type: 'kpi', title: 'Margen %', size: 'sm', config: { metricKey: 'profitMargin', prefix: '', suffix: '%', decimals: 1, targetKey: 'profitMarginMin' } },
  { type: 'kpi', title: 'ROAS', size: 'sm', config: { metricKey: 'roas', prefix: '', suffix: 'x', decimals: 2, targetKey: 'roasTarget' } },
  { type: 'kpi', title: 'True ROAS', size: 'sm', config: { metricKey: 'trueRoas', prefix: '', suffix: 'x', decimals: 2, targetKey: 'trueRoasTarget' } },
  { type: 'kpi', title: 'CPA', size: 'sm', config: { metricKey: 'cpa', prefix: '$', suffix: '', decimals: 0, targetKey: 'cpaMaximo', inverse: true } },
  {
    type: 'period-comparison',
    title: 'Comparación de ingresos',
    size: 'full',
    config: {
      metricKey: 'revenue',
      metricLabel: 'Ingresos',
      prefix: '$',
      suffix: '',
      decimals: 0,
      compact: true,
    },
  },

  { type: 'separator', title: 'Adquisición y conversión', size: 'full', config: {} },
  {
    type: 'line-chart',
    title: 'Tendencia de Ad Spend',
    size: 'lg',
    config: {
      metricKey: 'adSpend',
      metricLabel: 'Ad Spend',
      prefix: '$',
      suffix: '',
      decimals: 0,
      compact: true,
    },
  },
  {
    type: 'area-chart',
    title: 'Tendencia de ROAS',
    size: 'lg',
    config: {
      metricKey: 'roas',
      metricLabel: 'ROAS',
      prefix: '',
      suffix: 'x',
      decimals: 2,
    },
  },
  { type: 'funnel-chart', title: 'Embudo de Meta Ads', size: 'md', config: { funnelPreset: 'meta' } },
  {
    type: 'heatmap',
    title: 'Mapa de ingresos diarios',
    size: 'full',
    config: {
      metricKey: 'revenue',
      metricLabel: 'Ingresos',
      prefix: '$',
      suffix: '',
      decimals: 0,
      compact: true,
    },
  },

  { type: 'separator', title: 'Tienda y clientes', size: 'full', config: {} },
  { type: 'kpi-group', title: 'Tienda', size: 'md', config: { metrics: [
    { key: 'ordenesPositivas', label: 'Órdenes totales', prefix: '', suffix: '', decimals: 0 },
    { key: 'ordenesPositivas', label: 'Órdenes >$0', prefix: '', suffix: '', decimals: 0 },
    { key: 'revenue', label: 'Ingresos', prefix: '$', suffix: '', decimals: 0, compact: true },
    { key: 'netRevenue', label: 'Ingresos netos', prefix: '$', suffix: '', decimals: 0, compact: true },
    { key: 'aov', label: 'Ticket promedio', prefix: '$', suffix: '', decimals: 0 },
    { key: 'aovNeto', label: 'Ticket neto', prefix: '$', suffix: '', decimals: 0 },
    { key: 'devoluciones', label: 'Devoluciones', prefix: '', suffix: '', decimals: 0 },
  ] } },
  { type: 'kpi-group', title: 'Clientes Nuevos vs Recurrentes', size: 'md', config: { metrics: [
    { key: 'ncPct', label: 'NC %', prefix: '', suffix: '%', decimals: 1 },
    { key: 'ncOrdenes', label: 'NC Órdenes', prefix: '', suffix: '', decimals: 0 },
    { key: 'ncRevenue', label: 'Ingresos NC', prefix: '$', suffix: '', decimals: 0, compact: true },
    { key: 'ncCpa', label: 'NC CPA', prefix: '$', suffix: '', decimals: 0 },
    { key: 'ncRoas', label: 'NC ROAS', prefix: '', suffix: 'x', decimals: 2 },
    { key: 'rcOrdenes', label: 'RC Órdenes', prefix: '', suffix: '', decimals: 0 },
    { key: 'rcRevenue', label: 'Ingresos RC', prefix: '$', suffix: '', decimals: 0, compact: true },
  ] } },
  {
    type: 'donut-chart',
    title: 'Mix de ingresos NC vs RC',
    size: 'md',
    config: {
      metrics: [
        { key: 'ncRevenue', label: 'Ingresos NC', prefix: '$', suffix: '', decimals: 0, compact: true },
        { key: 'rcRevenue', label: 'Ingresos RC', prefix: '$', suffix: '', decimals: 0, compact: true },
      ],
    },
  },

  { type: 'separator', title: 'Costos y operación', size: 'full', config: {} },
  { type: 'kpi-group', title: 'Costos', size: 'full', config: { metrics: [
    { key: 'totalCostoProductos', label: 'Costo de productos', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalCostoEnvio', label: 'Costo Envío', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalComisionPago', label: 'Comisión Pago', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalComisionCuotas', label: 'Comisión Cuotas', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalImpuestosIBB', label: 'IBB', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalFeePlataforma', label: 'Cargo de plataforma', prefix: '$', suffix: '', decimals: 0 },
  ] } },
  {
    type: 'donut-chart',
    title: 'Composición de costos',
    size: 'md',
    config: {
      metrics: [
        { key: 'totalCostoProductos', label: 'Costo de productos', prefix: '$', suffix: '', decimals: 0, compact: true },
        { key: 'totalCostoEnvio', label: 'Costo Envío', prefix: '$', suffix: '', decimals: 0, compact: true },
        { key: 'totalComisionPago', label: 'Comisión Pago', prefix: '$', suffix: '', decimals: 0, compact: true },
        { key: 'totalFeePlataforma', label: 'Cargo de plataforma', prefix: '$', suffix: '', decimals: 0, compact: true },
      ],
    },
  },
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
