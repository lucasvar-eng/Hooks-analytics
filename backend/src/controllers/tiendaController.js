const { getTiendaBreakdown } = require('../services/tiendaService');

exports.getBreakdown = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const data = await getTiendaBreakdown(req.params.id, from, to);
    res.json(data);
  } catch (error) {
    next(error);
  }
};
