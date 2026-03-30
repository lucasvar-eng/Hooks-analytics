const Store = require('../models/Store');
const Insight = require('../models/Insight');
const logger = require('../utils/logger');

/**
 * Default thresholds used when store has no custom config.
 */
const DEFAULT_THRESHOLDS = {
  escalar: {
    roasMin: 5.0,        // ROAS >= 5x → ESCALAR
    minSpend: 5000,       // Must have minimum spend to be considered
    minPurchases: 5,      // Must have at least 5 purchases
  },
  mantener: {
    roasMin: 2.5,         // ROAS between 2.5x-5x → MANTENER
    minSpend: 3000,
  },
  revisar: {
    roasMin: 1.5,         // ROAS between 1.5x-2.5x → REVISAR
    cpaMaxPct: 150,       // CPA > 150% of store's cpaMaximo → REVISAR
  },
  pausar: {
    roasMax: 1.5,         // ROAS < 1.5x → PAUSAR
    minSpend: 10000,      // Only suggest pausing if significant spend
    minDays: 3,           // Must have been running at least 3 days
  },
  testear: {
    maxSpend: 10000,      // Low spend → might just need more data → TESTEAR
    maxPurchases: 3,      // Too few conversions to judge
  },
};

/**
 * Get thresholds for a store — custom or defaults.
 */
async function getThresholds(storeId) {
  const store = await Store.findById(storeId).select('objetivos adVerdictThresholds').lean();
  if (store?.adVerdictThresholds && Object.keys(store.adVerdictThresholds).length > 0) {
    // Merge with defaults for any missing keys
    return {
      escalar: { ...DEFAULT_THRESHOLDS.escalar, ...store.adVerdictThresholds.escalar },
      mantener: { ...DEFAULT_THRESHOLDS.mantener, ...store.adVerdictThresholds.mantener },
      revisar: { ...DEFAULT_THRESHOLDS.revisar, ...store.adVerdictThresholds.revisar },
      pausar: { ...DEFAULT_THRESHOLDS.pausar, ...store.adVerdictThresholds.pausar },
      testear: { ...DEFAULT_THRESHOLDS.testear, ...store.adVerdictThresholds.testear },
    };
  }
  return DEFAULT_THRESHOLDS;
}

/**
 * Classify a single campaign/ad based on its metrics and thresholds.
 * @param {Object} metrics - { spend, purchases, purchaseValue, impressions, clicks, days }
 * @param {Object} thresholds - The store's verdict thresholds
 * @param {Object} storeObjetivos - Store KPI objectives (for CPA comparison)
 * @returns {string} - ESCALAR | PAUSAR | TESTEAR | REVISAR | MANTENER
 */
function classifyCampaign(metrics, thresholds, storeObjetivos = {}) {
  const { spend = 0, purchases = 0, purchaseValue = 0, days = 7 } = metrics;
  const roas = spend > 0 ? purchaseValue / spend : 0;
  const cpa = purchases > 0 ? spend / purchases : Infinity;

  // TESTEAR: too little data to make a judgment
  if (spend < (thresholds.testear.maxSpend || 10000) && purchases < (thresholds.testear.maxPurchases || 3)) {
    return 'TESTEAR';
  }

  // ESCALAR: high ROAS + sufficient volume
  if (roas >= (thresholds.escalar.roasMin || 5) &&
      spend >= (thresholds.escalar.minSpend || 5000) &&
      purchases >= (thresholds.escalar.minPurchases || 5)) {
    return 'ESCALAR';
  }

  // PAUSAR: low ROAS + significant spend
  if (roas < (thresholds.pausar.roasMax || 1.5) &&
      spend >= (thresholds.pausar.minSpend || 10000)) {
    return 'PAUSAR';
  }

  // REVISAR: medium-low ROAS or high CPA
  const cpaMax = storeObjetivos?.kpis?.cpaMaximo;
  if (roas < (thresholds.revisar.roasMin || 2.5)) {
    return 'REVISAR';
  }
  if (cpaMax && cpa > cpaMax * ((thresholds.revisar.cpaMaxPct || 150) / 100)) {
    return 'REVISAR';
  }

  // MANTENER: decent ROAS
  if (roas >= (thresholds.mantener.roasMin || 2.5)) {
    return 'MANTENER';
  }

  return 'REVISAR';
}

/**
 * Classify all campaigns for a store and optionally generate insights.
 * @param {string} storeId
 * @param {Array} campaigns - Array of { metaId, nombre, spend, purchases, purchaseValue, impressions, clicks, days }
 * @param {Object} options - { generateInsights: boolean }
 * @returns {Array} - campaigns with added `verdict` field
 */
async function classifyAll(storeId, campaigns, options = {}) {
  const thresholds = await getThresholds(storeId);
  const store = await Store.findById(storeId).select('objetivos').lean();

  const results = campaigns.map((c) => ({
    ...c,
    verdict: classifyCampaign(c, thresholds, store?.objetivos),
  }));

  // Optionally generate insights from verdicts
  if (options.generateInsights) {
    const insightOps = [];

    const escalables = results.filter((c) => c.verdict === 'ESCALAR');
    const pausables = results.filter((c) => c.verdict === 'PAUSAR');

    for (const c of escalables.slice(0, 3)) {
      const roas = c.spend > 0 ? (c.purchaseValue / c.spend).toFixed(2) : 0;
      insightOps.push({
        storeId,
        section: 'meta',
        tipo: 'verdict',
        severidad: 'positive',
        titulo: `ESCALAR — ${c.nombre}`,
        descripcion: `ROAS ${roas}x | ${c.purchases} compras | $${Math.round(c.spend).toLocaleString()} gasto. Top performer, aumentar presupuesto.`,
        verdict: 'ESCALAR',
        layer: 'L1',
        generatedBy: 'rule_engine',
        metadata: { metaId: c.metaId, roas: parseFloat(roas), spend: c.spend },
      });
    }

    for (const c of pausables.slice(0, 3)) {
      const roas = c.spend > 0 ? (c.purchaseValue / c.spend).toFixed(2) : 0;
      insightOps.push({
        storeId,
        section: 'meta',
        tipo: 'verdict',
        severidad: 'critical',
        titulo: `PAUSAR — ${c.nombre}`,
        descripcion: `ROAS ${roas}x | ${c.purchases} compras | $${Math.round(c.spend).toLocaleString()} gasto. Retorno insuficiente, pausar y reasignar presupuesto.`,
        verdict: 'PAUSAR',
        layer: 'L1',
        generatedBy: 'rule_engine',
        metadata: { metaId: c.metaId, roas: parseFloat(roas), spend: c.spend },
      });
    }

    if (insightOps.length > 0) {
      // Clear old verdict insights for this store/section before inserting new ones
      await Insight.deleteMany({ storeId, section: 'meta', tipo: 'verdict', generatedBy: 'rule_engine' });
      await Insight.insertMany(insightOps);
    }
  }

  return results;
}

module.exports = { classifyCampaign, classifyAll, getThresholds, DEFAULT_THRESHOLDS };
