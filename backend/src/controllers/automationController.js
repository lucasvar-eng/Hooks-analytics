const Store = require('../models/Store');
const Report = require('../models/Report');
const { AutomationRule, runRule, getIntegrationCatalog, isRuleDue, runDueRulesForStore } = require('../services/automationService');
const User = require('../models/User');

exports.listRules = async (req, res) => {
  const rules = await AutomationRule.find({ storeId: req.params.id }).sort({ createdAt: -1 }).lean();
  const reportIds = rules.map((rule) => rule.lastReportId).filter(Boolean);
  const reports = reportIds.length
    ? await Report.find({ _id: { $in: reportIds } }).select('titulo createdAt model provider confidence generationMode qualityNote').lean()
    : [];
  const reportMap = new Map(reports.map((report) => [String(report._id), report]));

  res.json(
    rules.map((rule) => ({
      ...rule,
      isDue: isRuleDue(rule),
      lastReport: rule.lastReportId ? reportMap.get(String(rule.lastReportId)) || null : null,
    }))
  );
};

exports.getAIStatus = async (req, res) => {
  const user = await User.findById(req.user._id).select('+aiConfig.apiKeyEncrypted aiConfig.provider aiConfig.modelAnalysis aiConfig.modelChat aiConfig.modelReports');
  const { ai } = require('../config/environment');
  const hasUserKey = Boolean(user?.aiConfig?.apiKeyEncrypted);
  const envFallbackAvailable = Boolean(ai.anthropicApiKey || ai.openaiApiKey);
  const provider = hasUserKey
    ? user.aiConfig?.provider || 'anthropic'
    : ai.anthropicApiKey
      ? 'anthropic'
      : ai.openaiApiKey
        ? 'openai'
        : null;

  res.json({
    ready: hasUserKey || envFallbackAvailable,
    mode: hasUserKey ? 'user_key' : envFallbackAvailable ? 'env_fallback' : 'missing',
    provider,
    models: {
      analysis: user?.aiConfig?.modelAnalysis || ai.modelAnalysis,
      chat: user?.aiConfig?.modelChat || ai.modelChat,
      reports: user?.aiConfig?.modelReports || ai.modelReports,
    },
  });
};

exports.createRule = async (req, res) => {
  const { name, type, frequency, active, config } = req.body;
  const rule = await AutomationRule.create({
    storeId: req.params.id,
    name,
    type,
    frequency,
    active,
    config,
  });
  res.status(201).json(rule);
};

exports.updateRule = async (req, res) => {
  const { name, type, frequency, active, config } = req.body;
  const rule = await AutomationRule.findOneAndUpdate(
    { _id: req.params.ruleId, storeId: req.params.id },
    { name, type, frequency, active, config },
    { new: true }
  );
  if (!rule) return res.status(404).json({ error: 'Regla no encontrada' });
  res.json(rule);
};

exports.removeRule = async (req, res) => {
  await AutomationRule.findOneAndDelete({ _id: req.params.ruleId, storeId: req.params.id });
  res.json({ message: 'Regla eliminada' });
};

exports.runRuleNow = async (req, res) => {
  try {
    const rule = await AutomationRule.findOne({ _id: req.params.ruleId, storeId: req.params.id });
    if (!rule) return res.status(404).json({ error: 'Regla no encontrada' });

    const { report, result } = await runRule(rule, req.user._id);
    res.json({
      ok: true,
      reportId: report._id,
      reportTitle: report.titulo,
      lastRunAt: rule.lastRunAt,
      confidence: result.confidence,
      qualityNote: result.qualityNote,
    });
  } catch (error) {
    const rule = await AutomationRule.findOne({ _id: req.params.ruleId, storeId: req.params.id });
    if (rule) {
      rule.lastRunAt = new Date();
      rule.lastStatus = 'error';
      rule.lastError = error.message;
      await rule.save();
    }
    res.status(500).json({ error: error.message });
  }
};

exports.getIntegrationCatalog = async (req, res) => {
  const store = await Store.findById(req.params.id).lean();
  if (!store) return res.status(404).json({ error: 'Store not found' });
  res.json(getIntegrationCatalog(store));
};

exports.runDueRules = async (req, res) => {
  try {
    const result = await runDueRulesForStore(req.params.id, req.user._id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
