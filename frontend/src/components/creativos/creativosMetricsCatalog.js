/**
 * Catálogo de métricas para la página Creativos. KPIs específicos a nivel
 * ad (no a nivel campaña — eso ya vive en Meta Ads).
 *
 * Espera un objeto data computado a partir del array de ads:
 *   { totalAds, activeAds, pausedAds, withSpend, winners, bleeding,
 *     bleedingSpend, spendPerAd, bestRoas, bestRoasName, avgCtr,
 *     totalSpend, totalPurchases, totalRevenue, avgRoas }
 */

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}
function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '—';
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
function fmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('es-AR');
}
function fmtPct(v, digits = 1) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(digits)}%`;
}
function fmtMultiple(v, digits = 2) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(digits)}x`;
}

function toneFor(value, thresholds) {
  if (value == null || isNaN(value) || !thresholds) return null;
  const { good, bad, invert } = thresholds;
  const v = Number(value);
  if (invert) {
    if (good != null && v <= good) return 'good';
    if (bad != null && v >= bad) return 'bad';
    return null;
  }
  if (good != null && v >= good) return 'good';
  if (bad != null && v <= bad) return 'bad';
  return null;
}

/**
 * Compute summary stats sobre el array de ads que devuelve /creativos.
 * Esta es la fuente de verdad que se pasa como `data` a SourceMetricsRow.
 */
export function buildCreativosData(ads = []) {
  const totalAds = ads.length;
  if (totalAds === 0) return null;

  const active = ads.filter((a) => a.status === 'ACTIVE');
  const paused = ads.filter((a) => a.status === 'PAUSED');
  const withSpend = ads.filter((a) => Number(a.metrics?.spend || 0) > 0);
  const winners = ads.filter((a) => a.tier === 'A' || a.tier === 'B');
  const bleeding = withSpend.filter((a) => Number(a.metrics?.purchases || 0) === 0);

  const totalSpend = withSpend.reduce((s, a) => s + Number(a.metrics?.spend || 0), 0);
  const totalRevenue = withSpend.reduce((s, a) => s + Number(a.metrics?.purchaseValue || a.metrics?.revenue || 0), 0);
  const totalPurchases = withSpend.reduce((s, a) => s + Number(a.metrics?.purchases || 0), 0);
  const totalImpressions = withSpend.reduce((s, a) => s + Number(a.metrics?.impressions || 0), 0);
  const totalClicks = withSpend.reduce((s, a) => s + Number(a.metrics?.clicks || 0), 0);
  const bleedingSpend = bleeding.reduce((s, a) => s + Number(a.metrics?.spend || 0), 0);
  const spendPerAd = withSpend.length > 0 ? totalSpend / withSpend.length : 0;
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  // Mejor ROAS entre ads con al menos $1 de spend
  const bestRoasAd = withSpend.reduce(
    (best, a) => (Number(a.metrics?.roas || 0) > Number(best?.metrics?.roas || 0) ? a : best),
    null
  );
  const bestRoas = bestRoasAd?.metrics?.roas || 0;
  const bestRoasName = bestRoasAd?.nombre || bestRoasAd?.creativeName || '—';

  return {
    totalAds, activeAds: active.length, pausedAds: paused.length,
    withSpend: withSpend.length,
    winners: winners.length, winnersPct: totalAds > 0 ? (winners.length / totalAds) * 100 : 0,
    bleeding: bleeding.length, bleedingSpend,
    spendPerAd, totalSpend, totalRevenue, totalPurchases,
    bestRoas, bestRoasName,
    avgCtr, avgRoas,
  };
}

export const CREATIVOS_METRICS = [
  // Defaults — los 6 hero
  { key: 'totalAds', defaultLabel: 'Ads totales',
    getValue: (d) => fmtNum(d?.totalAds),
    getSub: (d) => `${d?.activeAds || 0} activos · ${d?.pausedAds || 0} pausados` },
  { key: 'winners', defaultLabel: 'Ads ganadores',
    getValue: (d) => fmtNum(d?.winners),
    getSub: (d) => `Tier A+B · ${(d?.winnersPct || 0).toFixed(1)}% del total`,
    getTone: (d) => toneFor(d?.winners, { good: 3, bad: 0 }) },
  { key: 'bleeding', defaultLabel: 'Ads sangrando',
    getValue: (d) => fmtNum(d?.bleeding),
    getSub: (d) => `${fmtMoneyShort(d?.bleedingSpend)} sin compras`,
    getTone: (d) => toneFor(d?.bleeding, { good: 0, bad: 3, invert: true }) },
  { key: 'spendPerAd', defaultLabel: 'Spend prom / ad',
    getValue: (d) => fmtMoneyShort(d?.spendPerAd),
    getSub: () => 'solo ads con gasto' },
  { key: 'bestRoas', defaultLabel: 'Mejor ROAS',
    getValue: (d) => fmtMultiple(d?.bestRoas),
    getSub: (d) => d?.bestRoasName ? String(d.bestRoasName).slice(0, 28) : 'sin datos',
    getTone: (d) => toneFor(d?.bestRoas, { good: 3, bad: 1 }) },
  { key: 'avgCtr', defaultLabel: 'CTR promedio',
    getValue: (d) => fmtPct(d?.avgCtr, 1),
    getSub: () => 'vs benchmark 1.5%',
    getTone: (d) => toneFor(d?.avgCtr, { good: 1.5, bad: 0.5 }) },

  // Disponibles en el picker
  { key: 'totalSpend', defaultLabel: 'Spend total',
    getValue: (d) => fmtMoney(d?.totalSpend) },
  { key: 'totalRevenue', defaultLabel: 'Revenue total',
    getValue: (d) => fmtMoney(d?.totalRevenue) },
  { key: 'totalPurchases', defaultLabel: 'Compras totales',
    getValue: (d) => fmtNum(d?.totalPurchases) },
  { key: 'avgRoas', defaultLabel: 'ROAS promedio',
    getValue: (d) => fmtMultiple(d?.avgRoas),
    getTone: (d) => toneFor(d?.avgRoas, { good: 2.5, bad: 1.5 }) },
];

export const CREATIVOS_DEFAULTS = ['totalAds', 'winners', 'bleeding', 'spendPerAd', 'bestRoas', 'avgCtr'];
