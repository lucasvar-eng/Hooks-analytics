const {
  getCashflowSummary,
  getCashflowForecast,
  getCashflowDaily,
  regenerateAllCashflow,
} = require('../services/cashflow');
const manualCashflow = require('../services/manualCashflow');
const CashflowManualEntry = require('../models/CashflowManualEntry');
const BankAccountBalance = require('../models/BankAccountBalance');

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

// === Movimientos manuales ===

exports.listManualEntries = async (req, res, next) => {
  try {
    const { type, category, estado, from, to } = req.query;
    const entries = await manualCashflow.listEntries({
      storeId: req.params.id, type, category, estado, from, to,
    });
    res.json(entries);
  } catch (error) { next(error); }
};

exports.upsertManualEntry = async (req, res, next) => {
  try {
    const result = await manualCashflow.upsertEntry({
      storeId: req.params.id,
      userId: req.user?.id,
      payload: req.body,
    });
    res.json(result);
  } catch (error) { next(error); }
};

exports.deleteManualEntry = async (req, res, next) => {
  try {
    await manualCashflow.deleteEntry({ storeId: req.params.id, id: req.params.entryId });
    res.json({ ok: true });
  } catch (error) { next(error); }
};

exports.getCategories = async (req, res) => {
  res.json({
    entryCategories: CashflowManualEntry.CATEGORIES,
    entryCategoryLabels: CashflowManualEntry.CATEGORY_LABELS,
    egresoCategories: CashflowManualEntry.EGRESO_CATEGORIES,
    accountTypes: BankAccountBalance.ACCOUNT_TYPES,
    accountTypeLabels: BankAccountBalance.ACCOUNT_TYPE_LABELS,
  });
};

// === Saldos bancarios ===

exports.listAccounts = async (req, res, next) => {
  try {
    const accounts = await manualCashflow.listAccounts(req.params.id);
    res.json(accounts);
  } catch (error) { next(error); }
};

exports.upsertAccount = async (req, res, next) => {
  try {
    const result = await manualCashflow.upsertAccount({
      storeId: req.params.id,
      userId: req.user?.id,
      payload: req.body,
    });
    res.json(result);
  } catch (error) { next(error); }
};

exports.archiveAccount = async (req, res, next) => {
  try {
    await manualCashflow.archiveAccount({ storeId: req.params.id, id: req.params.accountId });
    res.json({ ok: true });
  } catch (error) { next(error); }
};

// === Forecast unificado ===

exports.getProjection = async (req, res, next) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 60, 7), 180);
    const projection = await manualCashflow.getUnifiedProjection({
      storeId: req.params.id,
      days,
    });
    res.json(projection);
  } catch (error) { next(error); }
};
