/**
 * Catálogo de métricas de Meta Ads. Mismo shape que metricsCatalog del
 * Resumen para reusar SourceMetricsRow.
 *
 * El `data` que recibe es el `totals` del endpoint /meta/overview.
 */

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}
function fmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('es-AR');
}
function fmtPct(v, digits = 2) {
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

export const META_METRICS = [
  // Defaults — los KPIs más importantes
  { key: 'spend', defaultLabel: 'Importe gastado',
    getValue: (d) => fmtMoney(d?.spend),
    getSub: () => 'Inversión del período' },
  { key: 'revenue', defaultLabel: 'Valor de conversión',
    getValue: (d) => fmtMoney(d?.purchaseValue),
    getSub: () => 'Revenue atribuido a Meta' },
  { key: 'roas', defaultLabel: 'ROAS',
    getValue: (d) => fmtMultiple(d?.roas),
    getSub: () => 'Revenue / spend',
    getTone: (d) => toneFor(d?.roas, { good: 2.5, bad: 1.5 }) },
  { key: 'cpa', defaultLabel: 'CPA',
    getValue: (d) => fmtMoney(d?.cpa),
    getSub: () => 'Costo por compra' },
  { key: 'purchases', defaultLabel: 'Compras',
    getValue: (d) => fmtNum(d?.purchases),
    getSub: () => 'Atribuidas' },
  { key: 'ctr', defaultLabel: 'CTR',
    getValue: (d) => fmtPct(d?.ctr, 2),
    getSub: () => 'Click through rate',
    getTone: (d) => toneFor(d?.ctr, { good: 1.5, bad: 0.5 }) },

  // Disponibles en el picker
  { key: 'cpc', defaultLabel: 'CPC',
    getValue: (d) => fmtMoney(d?.cpc),
    getSub: () => 'Costo por click' },
  { key: 'cpm', defaultLabel: 'CPM',
    getValue: (d) => fmtMoney(d?.cpm),
    getSub: () => 'Costo por mil impresiones' },
  { key: 'impressions', defaultLabel: 'Impresiones',
    getValue: (d) => fmtNum(d?.impressions),
    getSub: () => 'Total servidas' },
  { key: 'reach', defaultLabel: 'Alcance',
    getValue: (d) => fmtNum(d?.reach),
    getSub: () => 'Personas únicas' },
  { key: 'clicks', defaultLabel: 'Clicks',
    getValue: (d) => fmtNum(d?.linkClicks || d?.clicks),
    getSub: () => 'Al link' },
  { key: 'atc', defaultLabel: 'Add to cart',
    getValue: (d) => fmtNum(d?.atc),
    getSub: () => 'Productos agregados' },
  { key: 'checkouts', defaultLabel: 'Checkout iniciado',
    getValue: (d) => fmtNum(d?.checkouts),
    getSub: () => 'Iniciaron compra' },
  { key: 'cvr', defaultLabel: 'CVR ad → compra',
    getValue: (d) => {
      const linkClicks = d?.linkClicks || d?.clicks || 0;
      if (linkClicks <= 0) return '—';
      return fmtPct((d?.purchases / linkClicks) * 100, 2);
    },
    getSub: () => 'Compra / click' },
];

export const META_DEFAULTS = ['spend', 'revenue', 'roas', 'cpa', 'purchases', 'ctr'];
