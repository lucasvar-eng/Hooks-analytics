const express = require('express');
const router = express.Router();
const topicMapController = require('../controllers/topicMapController');
const { auth } = require('../middleware/auth');
const storeContext = require('../middleware/storeContext');

router.use('/stores/:id', auth, storeContext);

router.get('/stores/:id/topic-maps', auth, topicMapController.list);
router.get('/stores/:id/topic-maps/overview', auth, topicMapController.overview);
router.post('/stores/:id/topic-maps', auth, topicMapController.create);
router.put('/stores/:id/topic-maps/:topicMapId', auth, topicMapController.update);
router.delete('/stores/:id/topic-maps/:topicMapId', auth, topicMapController.remove);

module.exports = router;
