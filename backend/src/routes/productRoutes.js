const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { auth } = require('../middleware/auth');
const storeContext = require('../middleware/storeContext');
const asyncHandler = require('../middleware/asyncHandler');

router.use('/stores/:id', auth, storeContext);

router.get('/stores/:id/products', auth, asyncHandler(productController.list));
router.get('/stores/:id/products/overview', auth, asyncHandler(productController.overview));
router.get('/stores/:id/products/commercial', auth, asyncHandler(productController.commercial));
router.get('/stores/:id/products/alerts', auth, asyncHandler(productController.alerts));
router.get('/stores/:id/products/cost-load-priority', auth, asyncHandler(productController.costLoadPriority));
router.get('/stores/:id/products/:productId/profile', auth, asyncHandler(productController.profile));
router.post('/stores/:id/products/:productId/simulate', auth, asyncHandler(productController.simulate));

module.exports = router;
