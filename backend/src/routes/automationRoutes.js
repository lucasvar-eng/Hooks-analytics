const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automationController');
const { auth, requireRole } = require('../middleware/auth');
const storeContext = require('../middleware/storeContext');

router.use('/stores/:id/automations', auth, storeContext);

router.get('/stores/:id/automations', auth, automationController.listRules);
router.post('/stores/:id/automations', auth, requireRole('admin', 'analyst'), automationController.createRule);
router.put('/stores/:id/automations/:ruleId', auth, requireRole('admin', 'analyst'), automationController.updateRule);
router.delete('/stores/:id/automations/:ruleId', auth, requireRole('admin', 'analyst'), automationController.removeRule);
router.post('/stores/:id/automations/:ruleId/run', auth, requireRole('admin', 'analyst'), automationController.runRuleNow);
router.post('/stores/:id/automations/run-due', auth, requireRole('admin', 'analyst'), automationController.runDueRules);
router.get('/stores/:id/automations/ai-status', auth, automationController.getAIStatus);
router.get('/stores/:id/automations/integrations/catalog', auth, automationController.getIntegrationCatalog);

module.exports = router;
