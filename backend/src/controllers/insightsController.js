const { buildAutoInsights } = require('../services/autoInsightsService');

exports.get = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const data = await buildAutoInsights(req.params.id, from, to);
    if (!data) return res.status(404).json({ error: 'Store not found' });
    res.json(data);
  } catch (error) {
    next(error);
  }
};
