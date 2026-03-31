const Product = require('../models/Product');
const { getProductsWithMetrics, getProductProfile, simulateProduct, getStockAlerts, getProductOverview, getCommercialOverview } = require('../services/productService');

exports.list = async (req, res) => {
  const { from, to, page = 1, limit = 50 } = req.query;
  const result = await getProductsWithMetrics(req.params.id, from, to, +page, +limit);
  res.json(result);
};

exports.profile = async (req, res) => {
  const product = await getProductProfile(req.params.id, req.params.productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
};

exports.simulate = async (req, res) => {
  const product = await Product.findOne({ storeId: req.params.id, _id: req.params.productId }).lean();
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const result = simulateProduct(product, req.body);
  res.json(result);
};

exports.alerts = async (req, res) => {
  const alerts = await getStockAlerts(req.params.id);
  res.json(alerts);
};

exports.overview = async (req, res) => {
  const { from, to } = req.query;
  const overview = await getProductOverview(req.params.id, from, to);
  res.json(overview);
};

exports.commercial = async (req, res) => {
  const { from, to } = req.query;
  const overview = await getCommercialOverview(req.params.id, from, to);
  res.json(overview);
};
