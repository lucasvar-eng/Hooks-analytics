/**
 * Catálogo de métricas disponibles por source, usado por SourceMetricsRow.
 * Cada métrica tiene un key estable (no cambia aunque renames defaultLabel)
 * porque el storage local guarda selecciones por key.
 */

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
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
function fmtDelta(pct, options = {}) {
  if (pct == null || isNaN(pct) || pct === 0) return { text: '—', tone: 'neutral' };
  const value = Math.abs(Number(pct)).toFixed(1);
  const isPositive = pct > 0;
  const invert = options.invert === true;
  const improves = invert ? !isPositive : isPositive;
  return {
    text: `${isPositive ? '↑' : '↓'} ${value}%`,
    tone: improves ? 'up' : 'down',
  };
}

export const META_METRICS = [
  { key: 'adSpend', defaultLabel: 'Ad Spend',
    getValue: (d) => fmtMoney(d?.adSpend),
    getDelta: (_, dx) => fmtDelta(dx?.adSpend, { invert: true }) },
  { key: 'metaRevenue', defaultLabel: 'Revenue atribuido',
    getValue: (d) => fmtMoney(d?.metaPurchaseValue || d?.revenue),
    getDelta: (_, dx) => fmtDelta(dx?.metaPurchaseValue || dx?.revenue) },
  { key: 'roas', defaultLabel: 'ROAS',
    getValue: (d) => fmtMultiple(d?.roas),
    getDelta: (_, dx) => fmtDelta(dx?.roas) },
  { key: 'cpa', defaultLabel: 'CPA',
    getValue: (d) => fmtMoney(d?.cpa),
    getDelta: (_, dx) => fmtDelta(dx?.cpa, { invert: true }) },
  { key: 'metaPurchases', defaultLabel: 'Compras',
    getValue: (d) => fmtNum(d?.metaPurchases),
    getDelta: (_, dx) => fmtDelta(dx?.metaPurchases) },
  { key: 'ctr', defaultLabel: 'CTR',
    getValue: (d) => fmtPct(d?.ctr, 2),
    getDelta: (_, dx) => fmtDelta(dx?.ctr) },
  { key: 'cpc', defaultLabel: 'CPC',
    getValue: (d) => fmtMoney(d?.cpc),
    getDelta: (_, dx) => fmtDelta(dx?.cpc, { invert: true }) },
  { key: 'cpm', defaultLabel: 'CPM',
    getValue: (d) => fmtMoney(d?.cpm),
    getDelta: (_, dx) => fmtDelta(dx?.cpm, { invert: true }) },
  { key: 'impressions', defaultLabel: 'Impresiones',
    getValue: (d) => fmtNum(d?.impressions) },
  { key: 'reach', defaultLabel: 'Alcance',
    getValue: (d) => fmtNum(d?.reach) },
  { key: 'frequency', defaultLabel: 'Frecuencia',
    getValue: (d) => fmtMultiple(d?.frequencyAvg) },
  { key: 'addToCart', defaultLabel: 'Add to Cart',
    getValue: (d) => fmtNum(d?.addToCart) },
  { key: 'initiatedCheckout', defaultLabel: 'Checkout iniciado',
    getValue: (d) => fmtNum(d?.initiatedCheckout) },
  { key: 'trueRoas', defaultLabel: 'True ROAS',
    getValue: (d) => fmtMultiple(d?.trueRoas) },
];

export const TN_METRICS = [
  { key: 'revenue', defaultLabel: 'Revenue',
    getValue: (d) => fmtMoney(d?.revenue),
    getDelta: (_, dx) => fmtDelta(dx?.revenue) },
  { key: 'ordenes', defaultLabel: 'Órdenes',
    getValue: (d) => fmtNum(d?.ordenesPositivas || d?.ordenes),
    getDelta: (_, dx) => fmtDelta(dx?.ordenesPositivas) },
  { key: 'aov', defaultLabel: 'AOV',
    getValue: (d) => fmtMoney(d?.aov),
    getDelta: (_, dx) => fmtDelta(dx?.aov) },
  { key: 'aovNeto', defaultLabel: 'AOV neto',
    getValue: (d) => fmtMoney(d?.aovNeto),
    getDelta: (_, dx) => fmtDelta(dx?.aovNeto), coverageAware: true },
  { key: 'cvr', defaultLabel: 'CVR',
    getValue: (d) => fmtPct(d?.conversionRate, 2),
    getDelta: (_, dx) => fmtDelta(dx?.conversionRate) },
  { key: 'ncPct', defaultLabel: '% NC',
    getValue: (d) => fmtPct(d?.ncPct, 1),
    getSub: () => 'Clientes nuevos' },
  { key: 'netRevenue', defaultLabel: 'Revenue neto',
    getValue: (d) => fmtMoney(d?.netRevenue),
    getDelta: (_, dx) => fmtDelta(dx?.netRevenue),
    coverageAware: true },
];

export const PNL_METRICS = [
  { key: 'profit', defaultLabel: 'Ganancia neta',
    getValue: (d) => fmtMoney(d?.officialProfit ?? d?.adjustedProfit),
    getDelta: (_, dx) => fmtDelta(dx?.officialProfit ?? dx?.adjustedProfit),
    getSub: () => 'Después de ads y fijos',
    coverageAware: true },
  { key: 'profitMarginNeto', defaultLabel: 'Margen neto',
    getValue: (d) => fmtPct(d?.officialProfitMargin ?? d?.adjustedProfitMargin, 2),
    getDelta: (_, dx) => fmtDelta(dx?.officialProfitMargin ?? dx?.adjustedProfitMargin),
    getSub: () => 'Sobre ingresos',
    coverageAware: true },
  { key: 'profitMarginBruto', defaultLabel: 'Margen bruto',
    getValue: (d) => fmtPct(d?.profitMargin, 2),
    getDelta: (_, dx) => fmtDelta(dx?.profitMargin),
    getSub: () => 'Sin ads ni fijos',
    coverageAware: true },
  { key: 'trueRoasPnl', defaultLabel: 'True ROAS',
    getValue: (d) => fmtMultiple(d?.officialTrueRoas ?? d?.trueRoas),
    getDelta: (_, dx) => fmtDelta(dx?.officialTrueRoas ?? dx?.trueRoas),
    getSub: () => 'Profit / Ad Spend' },
  { key: 'breakevenRoas', defaultLabel: 'Breakeven ROAS',
    getValue: (d, target) => fmtMultiple(target?.breakeven?.roasBreakeven),
    getSub: () => 'A partir de eso, ganás' },
  { key: 'fixedCosts', defaultLabel: 'Costos fijos',
    getValue: (d) => fmtMoney(d?.fixedCosts) },
];

export const DEFAULTS = {
  meta: ['adSpend', 'metaRevenue', 'roas', 'cpa', 'metaPurchases'],
  tn:   ['revenue', 'ordenes', 'aov', 'cvr', 'ncPct'],
  pnl:  ['profit', 'profitMarginNeto', 'profitMarginBruto', 'trueRoasPnl', 'breakevenRoas'],
};
