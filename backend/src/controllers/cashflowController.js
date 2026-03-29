const {
  getCashflowSummary,
  getCashflowForecast,
  getCashflowDaily,
  regenerateAllCashflow,
} = require('../services/cashflow');

exports.getSummary = async (req, res) => {
  const { from, to } = req.query;
  const summary = await getCashflowSummary(req.params.id, from, to);
  res.json(summary);
};

exports.getForecast = async (req, res) => {
  const weeks = parseInt(req.query.weeks) || 4;
  const forecast = await getCashflowForecast(req.params.id, weeks);
  res.json(forecast);
};

exports.getDaily = async (req, res) => {
  const { from, to } = req.query;
  const daily = await getCashflowDaily(req.params.id, from, to);
  res.json(daily);
};

exports.regenerate = async (req, res) => {
  const count = await regenerateAllCashflow(req.params.id);
  res.json({ message: `Regenerated cashflow for ${count} orders` });
};
