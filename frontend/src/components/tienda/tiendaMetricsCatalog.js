/**
 * Catálogo de métricas de la página Tienda. Mismo shape que metricsCatalog del
 * Resumen para reusar SourceMetricsRow.
 *
 * El `data` que SourceMetricsRow recibe es un objeto plano combinado de
 * summary + ncrc + devoluciones (ver buildTiendaData en Tienda.jsx).
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
function fmtDecimal(v, digits = 1) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toFixed(digits);
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

export const TIENDA_METRICS = [
  // Más usados — defaults
  { key: 'facturacion', defaultLabel: 'Facturación',
    getValue: (d) => fmtMoney(d?.totalRevenue),
    getSub: () => 'Bruto del período' },
  { key: 'ventas', defaultLabel: 'Ventas',
    getValue: (d) => fmtNum(d?.totalOrdenes),
    getSub: () => 'Órdenes positivas' },
  { key: 'aov', defaultLabel: 'AOV',
    getValue: (d) => fmtMoney(d?.aov),
    getSub: () => 'Ticket promedio' },
  { key: 'ncPct', defaultLabel: '% NC',
    getValue: (d) => fmtPct(d?.ncPct, 1),
    getSub: () => 'Clientes nuevos',
    getTone: (d) => toneFor(d?.ncPct, { good: 50, bad: 80, invert: true }) },
  { key: 'ingresosNetos', defaultLabel: 'Ingresos netos',
    getValue: (d) => fmtMoney(d?.totalNeto),
    getSub: () => 'Después de costos',
    coverageAware: true },
  { key: 'avgCuotas', defaultLabel: 'Cuotas promedio',
    getValue: (d) => fmtDecimal(d?.avgCuotas, 1),
    getSub: () => 'Por orden' },

  // Disponibles en el picker pero no por default
  { key: 'aovNeto', defaultLabel: 'AOV neto',
    getValue: (d) => fmtMoney(d?.aovNeto),
    getSub: () => 'Ticket neto',
    coverageAware: true },
  { key: 'liquidable', defaultLabel: 'Liquidable',
    getValue: (d) => fmtMoney(d?.totalLiquidable),
    getSub: () => 'Cash que entra' },
  { key: 'ncOrdenes', defaultLabel: 'NC órdenes',
    getValue: (d) => fmtNum(d?.ncOrdenes),
    getSub: () => 'Nuevos clientes' },
  { key: 'rcOrdenes', defaultLabel: 'RC órdenes',
    getValue: (d) => fmtNum(d?.rcOrdenes),
    getSub: () => 'Recurrentes' },
  { key: 'devoluciones', defaultLabel: 'Devoluciones',
    getValue: (d) => fmtNum(d?.devolucionesCount),
    getSub: () => 'Cantidad' },
  { key: 'totalDevuelto', defaultLabel: 'Total devuelto',
    getValue: (d) => fmtMoney(d?.devolucionesTotal),
    getSub: () => 'Monto devuelto' },
];

export const TIENDA_DEFAULTS = ['facturacion', 'ventas', 'aov', 'ncPct', 'ingresosNetos', 'avgCuotas'];
