const Insight = require('../models/Insight');
const { analyze, structuredInsights } = require('../services/aiService');
const logger = require('../utils/logger');

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

// POST /stores/:id/insights/generate — generate AI insights for a section
exports.generate = async (req, res, next) => {
  try {
    const storeId = req.params.id;
    const { section = 'dashboard' } = req.body;

    // Get date range from query or default to last 30 days
    const to = new Date().toISOString().slice(0, 10);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    const from = fromDate.toISOString().slice(0, 10);

    let result;
    try {
      result = await structuredInsights(section, storeId, from, to, req.user._id);
    } catch (error) {
      logger.warn(`Structured insights failed, falling back to text parse: ${error.message}`);
      const fallback = await analyze(section, storeId, from, to, req.user._id);
      const lines = fallback.analysis.split('\n').filter((l) => l.trim());
      result = {
        confidence: fallback.confidence ?? 0.5,
        provider: fallback.provider,
        model: fallback.model,
        tokensUsed: fallback.tokensUsed,
        insights: lines
          .map((line) => line.replace(/^[-*#\s]+/, '').trim())
          .filter((line) => line.length >= 10)
          .slice(0, 8)
          .map((line) => ({
            titulo: line.length > 80 ? `${line.slice(0, 80)}...` : line,
            descripcion: line,
            tipo: 'diagnostic',
            severidad: 'neutral',
            verdict: null,
            metricKey: null,
            impacto: null,
          })),
      };
    }

    const insights = result.insights.map((item) => ({
      storeId,
      section,
      tipo: item.tipo || 'diagnostic',
      severidad: item.severidad || 'neutral',
      titulo: item.titulo,
      descripcion: item.descripcion,
      impacto: item.impacto || undefined,
      verdict: item.verdict || null,
      layer: 'L2',
      generatedBy: result.provider === 'openai' ? 'openai' : 'claude',
      metricKey: item.metricKey || undefined,
      confidence: result.confidence ?? 0.5,
      metadata: {
        model: result.model,
        tokensUsed: result.tokensUsed,
        summary: result.summary,
      },
    }));

    // Clear old AI-generated insights for this section, then insert new
    if (insights.length > 0) {
      await Insight.deleteMany({ storeId, section, generatedBy: { $in: ['claude', 'openai'] } });
      await Insight.insertMany(insights.slice(0, 20)); // cap at 20
    }

    res.json({ count: insights.length, tokensUsed: result.tokensUsed, confidence: result.confidence ?? 0.5 });
  } catch (error) {
    logger.error('Insight generate error:', error.message);
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
