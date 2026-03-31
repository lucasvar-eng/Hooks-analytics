const Target = require('../models/Target');
const Store = require('../models/Store');

function normalizeDate(dateLike, fallback) {
  const date = dateLike ? new Date(dateLike) : new Date(fallback);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getCurrentMonthRange(dateLike = new Date()) {
  const start = new Date(dateLike);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(0);
  end.setHours(23, 59, 59, 999);

  return { periodStart: start, periodEnd: end };
}

async function getEffectiveTarget(storeId, { from, to } = {}) {
  const nowRange = getCurrentMonthRange(from || new Date());
  const periodStart = normalizeDate(from, nowRange.periodStart);
  const periodEnd = normalizeDate(to, nowRange.periodEnd);
  periodEnd.setHours(23, 59, 59, 999);

  let target = await Target.findOne({
    storeId,
    isActive: true,
    periodStart: { $lte: periodStart },
    periodEnd: { $gte: periodEnd },
  })
    .sort({ periodStart: -1 })
    .lean();

  if (target) return target;

  const store = await Store.findById(storeId).select('objetivos').lean();
  if (!store?.objetivos) return null;

  return {
    periodStart,
    periodEnd,
    phase: store.objetivos.fase || 'crecimiento',
    kpis: store.objetivos.kpis || {},
    breakeven: store.objetivos.breakeven || {},
    alertThresholds: store.objetivos.alertThresholds || { warningPct: 10, criticalPct: 25 },
    source: 'migration',
    isFallback: true,
  };
}

module.exports = {
  getCurrentMonthRange,
  getEffectiveTarget,
};
