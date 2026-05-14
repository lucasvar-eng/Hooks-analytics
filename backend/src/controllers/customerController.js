const { getCustomers, getCohortTable, getSegments, calculateRFM, getQualityChecks, getPeriodInsights } = require('../services/customerService');

exports.list = async (req, res) => {
  const { page = 1, limit = 50, segment } = req.query;
  const result = await getCustomers(req.params.id, +page, +limit, segment);
  res.json(result);
};

exports.periodInsights = async (req, res) => {
  const { from, to } = req.query;
  const result = await getPeriodInsights(req.params.id, from, to);
  res.json(result);
};

exports.cohorts = async (req, res) => {
  const cohorts = await getCohortTable(req.params.id);
  res.json(cohorts);
};

exports.segments = async (req, res) => {
  const segments = await getSegments(req.params.id);
  res.json(segments);
};

exports.recalculateRFM = async (req, res) => {
  const count = await calculateRFM(req.params.id);
  res.json({ message: `RFM calculated for ${count} customers` });
};

exports.quality = async (req, res) => {
  const checks = await getQualityChecks(req.params.id);
  res.json(checks);
};
