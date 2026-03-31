const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { auth } = require('../middleware/auth');
const storeContext = require('../middleware/storeContext');

router.use('/stores/:id', auth, storeContext);

router.get('/stores/:id/products', auth, productController.list);
router.get('/stores/:id/products/overview', auth, productController.overview);
router.get('/stores/:id/products/commercial', auth, productController.commercial);
router.get('/stores/:id/products/alerts', auth, productController.alerts);
router.get('/stores/:id/products/:productId/profile', auth, productController.profile);
router.post('/stores/:id/products/:productId/simulate', auth, productController.simulate);

module.exports = router;
