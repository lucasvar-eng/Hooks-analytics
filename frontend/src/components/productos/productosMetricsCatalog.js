/**
 * Catálogo de métricas del header "Indicadores" en la página Productos.
 * El usuario elige hasta 4 — la selección se persiste en localStorage por tienda.
 *
 * Cada entry: { key, defaultLabel, getValue(data), getSub(data), tone? }
 *   - data viene del padre con: overview.summary, commercial, currentMetrics
 *   - tone (opcional): 'good' | 'warn' | 'bad' — se aplica al valor
 */

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}
function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '—';
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
function fmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('es-AR');
}
function fmtPct(v, digits = 1) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(digits).replace('.', ',')}%`;
}

export const PRODUCTOS_METRICS = [
  {
    key: 'rotacion',
    defaultLabel: 'Rotación',
    getValue: (d) => {
      const total = d?.summary?.totalProducts || 0;
      const sold = d?.soldCount || 0;
      if (!total) return '—';
      return fmtPct((sold / total) * 100, 1);
    },
    getSub: (d) => {
      const total = d?.summary?.totalProducts || 0;
      const sold = d?.soldCount || 0;
      return `${fmtNum(sold)} de ${fmtNum(total)} con venta`;
    },
    getTone: (d) => {
      const total = d?.summary?.totalProducts || 0;
      const sold = d?.soldCount || 0;
      if (!total) return null;
      const pct = (sold / total) * 100;
      if (pct >= 30) return 'good';
      if (pct >= 15) return 'warn';
      return 'bad';
    },
  },
  {
    key: 'sinmov',
    defaultLabel: 'Sin movimiento',
    getValue: (d) => fmtNum(d?.summary?.deadStockCount),
    getSub: (d) => {
      const total = d?.summary?.totalProducts || 0;
      const dead = d?.summary?.deadStockCount || 0;
      if (!total) return 'Sin datos';
      return `${fmtPct((dead / total) * 100, 0)} del catálogo`;
    },
    getTone: (d) => {
      const total = d?.summary?.totalProducts || 0;
      const dead = d?.summary?.deadStockCount || 0;
      if (!total) return null;
      const pct = (dead / total) * 100;
      if (pct >= 50) return 'warn';
      return null;
    },
  },
  {
    key: 'sinstock',
    defaultLabel: 'Sin stock',
    getValue: (d) => fmtNum(d?.summary?.stockoutCount),
    getSub: (d) => {
      const total = d?.summary?.totalProducts || 0;
      const out = d?.summary?.stockoutCount || 0;
      if (!total) return 'Sin datos';
      return `${fmtPct((out / total) * 100, 1)} · pérdida de venta`;
    },
    getTone: (d) => {
      const out = d?.summary?.stockoutCount || 0;
      const sold = d?.soldCount || 0;
      // Si hay stockouts comparables al volumen de productos que venden, es preocupante
      if (sold > 0 && out / Math.max(sold, 1) > 0.2) return 'warn';
      return null;
    },
  },
  {
    key: 'atrapado',
    defaultLabel: 'Stock atrapado',
    coverageAware: true,
    getValue: (d) => {
      const v = d?.capitalTrappedValue;
      if (!v || v <= 0) return 'Sin datos';
      return fmtMoneyShort(v);
    },
    getSub: (d) => {
      const v = d?.capitalTrappedValue;
      if (!v || v <= 0) return 'Falta cargar costos';
      const count = d?.capitalTrappedCount || 0;
      return `${fmtNum(count)} productos sin movimiento`;
    },
    getTone: () => null,
  },
  {
    key: 'sobrestock',
    defaultLabel: 'Sobrestock',
    getValue: (d) => fmtNum(d?.summary?.overstockCount),
    getSub: (d) => {
      const total = d?.summary?.totalProducts || 0;
      const over = d?.summary?.overstockCount || 0;
      if (!total) return 'Sin datos';
      return `${fmtPct((over / total) * 100, 0)} del catálogo`;
    },
    getTone: () => null,
  },
  {
    key: 'totales',
    defaultLabel: 'Productos totales',
    getValue: (d) => fmtNum(d?.summary?.totalProducts),
    getSub: (d) => `${fmtNum(d?.activeCount || 0)} activos · ${fmtNum(d?.inactiveCount || 0)} inactivos`,
  },
  {
    key: 'ingresos',
    defaultLabel: 'Ingresos período',
    getValue: (d) => fmtMoneyShort(d?.summary?.periodRevenue),
    getSub: (d) => `${fmtNum(d?.summary?.periodSales)} unidades movidas`,
  },
  {
    key: 'unidades',
    defaultLabel: 'Unidades vendidas',
    getValue: (d) => fmtNum(d?.summary?.periodSales),
    getSub: (d) => {
      const rev = d?.summary?.periodRevenue || 0;
      const units = d?.summary?.periodSales || 0;
      if (!units) return '—';
      return `Ticket prom. ${fmtMoney(rev / units)}`;
    },
  },
  {
    key: 'ticket',
    defaultLabel: 'Ticket promedio',
    getValue: (d) => {
      const rev = d?.summary?.periodRevenue || 0;
      const units = d?.summary?.periodSales || 0;
      if (!units) return '—';
      return fmtMoney(rev / units);
    },
    getSub: () => 'Por unidad vendida',
  },
  {
    key: 'cobertura',
    defaultLabel: 'Cobertura costos',
    coverageAware: true,
    getValue: (d) => fmtPct(d?.summary?.costCoveragePct, 0),
    getSub: (d) => `${fmtNum(d?.summary?.productsWithCosts)} de ${fmtNum(d?.summary?.totalProducts)} con costo`,
    getTone: (d) => {
      const pct = d?.summary?.costCoveragePct || 0;
      if (pct >= 80) return 'good';
      if (pct >= 40) return 'warn';
      return 'bad';
    },
  },
];

export const PRODUCTOS_DEFAULTS = ['rotacion', 'sinmov', 'sinstock', 'atrapado'];
export const PRODUCTOS_MAX_SELECTED = 4;
