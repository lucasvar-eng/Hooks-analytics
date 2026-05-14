const Insight = require('../models/Insight');

// GET /stores/:id/insights?section=&tipo=&estado=
exports.list = async (req, res, next) => {
  try {
    const filter = { storeId: req.params.id };
    if (req.query.section) filter.section = req.query.section;
    if (req.query.tipo) filter.tipo = req.query.tipo;
    if (req.query.estado) filter.estado = req.query.estado;

    const insights = await Insight.find(filter)
      .sort({ pinned: -1, createdAt: -1 })
      .limit(100)
      .lean();

    res.json(insights);
  } catch (error) {
    next(error);
  }
};

// GET /stores/:id/insights/top
exports.getTopInsight = async (req, res, next) => {
  try {
    const severityOrder = { critical: 0, warning: 1, positive: 2, diagnostic: 3, verdict: 4, neutral: 5 };

    // Fetch active insights for the store (limit to a reasonable pool)
    const insights = await Insight.find({ storeId: req.params.id, estado: 'active' })
      .sort({ pinned: -1, createdAt: -1 })
      .limit(200)
      .lean();

    if (!insights.length) return res.json(null);

    // Sort: pinned first, then by severity rank, then most recent
    const sorted = insights.sort((a, b) => {
      if (b.pinned !== a.pinned) return b.pinned - a.pinned;
      const aSev = severityOrder[a.severidad] ?? 99;
      const bSev = severityOrder[b.severidad] ?? 99;
      if (aSev !== bSev) return aSev - bSev;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(sorted[0]);
  } catch (error) {
    next(error);
  }
};

// POST /stores/:id/insights
exports.create = async (req, res, next) => {
  try {
    const {
      section,
      tipo,
      severidad,
      titulo,
      descripcion,
      impacto,
      verdict,
      layer,
      generatedBy,
      metricKey,
      metadata,
      pinned,
    } = req.body;

    if (!section || !tipo || !titulo) {
      return res.status(400).json({ error: 'section, tipo, and titulo are required' });
    }

    const insight = await Insight.create({
      storeId: req.params.id,
      section,
      tipo,
      severidad,
      titulo,
      descripcion,
      impacto,
      verdict: verdict ?? null,
      layer: layer || 'L3',
      generatedBy: 'manual',
      metricKey,
      metadata,
      pinned: pinned || false,
      estado: 'active',
      createdBy: req.user._id,
    });

    res.status(201).json(insight);
  } catch (error) {
    next(error);
  }
};

// PUT /stores/:id/insights/:insightId/dismiss
exports.dismiss = async (req, res, next) => {
  try {
    const insight = await Insight.findOneAndUpdate(
      { _id: req.params.insightId, storeId: req.params.id },
      { estado: 'dismissed' },
      { new: true }
    );
    if (!insight) return res.status(404).json({ error: 'Insight not found' });
    res.json(insight);
  } catch (error) {
    next(error);
  }
};

// PUT /stores/:id/insights/:insightId/resolve
exports.resolve = async (req, res, next) => {
  try {
    const insight = await Insight.findOneAndUpdate(
      { _id: req.params.insightId, storeId: req.params.id },
      { estado: 'resolved' },
      { new: true }
    );
    if (!insight) return res.status(404).json({ error: 'Insight not found' });
    res.json(insight);
  } catch (error) {
    next(error);
  }
};

// PUT /stores/:id/insights/:insightId/pin
exports.pin = async (req, res, next) => {
  try {
    const insight = await Insight.findOne({ _id: req.params.insightId, storeId: req.params.id });
    if (!insight) return res.status(404).json({ error: 'Insight not found' });

    insight.pinned = !insight.pinned;
    await insight.save();

    res.json(insight);
  } catch (error) {
    next(error);
  }
};
