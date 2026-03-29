const express = require('express');
const multer = require('multer');
const router = express.Router();
const metaController = require('../controllers/metaController');
const { auth, requireRole } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// OAuth
router.get('/connect/:storeId', auth, metaController.connect);
router.get('/callback', metaController.callback); // No auth — Meta redirects here

// Data (all require auth)
router.get('/stores/:id/meta/campaigns', auth, metaController.getCampaigns);
router.get('/stores/:id/meta/campaigns/:campaignId/adsets', auth, metaController.getAdSets);
router.get('/stores/:id/meta/adsets/:adsetId/ads', auth, metaController.getAds);
router.post('/stores/:id/meta/import', auth, requireRole('admin', 'analyst'), upload.single('file'), metaController.importCSV);

module.exports = router;
