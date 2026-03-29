const { autoClassifyAds, getCampaignResults } = require('../services/creativeService');

exports.getCreativos = async (req, res) => {
  const { from, to } = req.query;
  const ads = await autoClassifyAds(req.params.id, from, to);
  res.json(ads);
};

exports.getCampaignResults = async (req, res) => {
  const { from, to } = req.query;
  const results = await getCampaignResults(req.params.id, from, to);
  res.json(results);
};
