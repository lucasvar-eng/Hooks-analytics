const { aggregateRange } = require('./metricCalculator');
const { getPnL } = require('./costosService');

async function getFinancialConsistency(storeId, from, to) {
  const [metrics, pnl] = await Promise.all([
    aggregateRange(storeId, from, to),
    getPnL(storeId, from, to),
  ]);

  const contributionDiff = (pnl.contributionProfit || 0) - (metrics.profit || 0);
  const officialDiff = (pnl.profit || 0) - (metrics.officialProfit || 0);
  const aligned = Math.abs(contributionDiff) < 1 && Math.abs(officialDiff) < 1;
  const integrity = metrics.sourceCoverage?.integrity || {
    totalDays: 0,
    ordersBackedDays: 0,
    legacyOnlyDays: 0,
    mismatchedDays: 0,
    ordersBackedPct: 0,
  };

  return {
    officialMetric: {
      name: 'adjusted_profit_after_fixed_costs',
      profit: pnl.profit || 0,
      profitMargin: pnl.profitMargin || 0,
      trueRoas: metrics.officialTrueRoas || 0,
      contributionProfit: pnl.contributionProfit || 0,
      fixedCosts: (pnl.fixedCosts || []).reduce((sum, item) => sum + (item.montoProrrateado || 0), 0),
      dataSource: pnl.dataSource || 'unknown',
    },
    reconciliation: {
      status: aligned ? 'aligned' : 'review',
      contributionDiff,
      officialDiff,
    },
    integrity,
    quality: {
      level:
        integrity.ordersBackedPct >= 80
          ? 'high'
          : integrity.ordersBackedPct >= 40
            ? 'medium'
            : 'low',
      note:
        integrity.ordersBackedPct >= 80
          ? 'La mayor parte del período está respaldada por órdenes.'
          : integrity.ordersBackedPct >= 40
            ? 'Hay mezcla entre días respaldados y días legacy.'
            : 'Predominan datos legacy o faltantes en el período.',
    },
  };
}

module.exports = { getFinancialConsistency };
