const Widget = require('../models/Widget');

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
    const { type, title, config, pageId, order } = req.body;
    if (!type || !title) return res.status(400).json({ error: 'type and title required' });

    // Auto-assign order if not provided
    const count = await Widget.countDocuments({ storeId: req.params.id, pageId: pageId || 'dashboard' });

    const widget = await Widget.create({
      storeId: req.params.id,
      pageId: pageId || 'dashboard',
      type,
      title,
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
    const { title, config, order } = req.body;
    const update = {};
    if (title !== undefined) update.title = title;
    if (config !== undefined) update.config = config;
    if (order !== undefined) update.order = order;

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
    const { items } = req.body; // [{ _id, order }]
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
