/**
 * Catálogo de métricas del header "Indicadores" en la página Clientes.
 * El usuario elige hasta 4 — la selección se persiste en localStorage por tienda.
 *
 * Cada entry: { key, defaultLabel, info, getValue(data), getSub(data), getTone? }
 *   - data: { customers, segments, total }
 *   - info: texto del tooltip ⓘ (1-2 líneas)
 *   - tone (opcional): 'good' | 'warn' | 'bad'
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

const SEG_COUNT = (segments, id) => {
  const s = (segments || []).find((x) => x._id === id);
  return s?.count || 0;
};
const SEG_REVENUE = (segments, id) => {
  const s = (segments || []).find((x) => x._id === id);
  return s?.totalRevenue || 0;
};
const TOTAL_SEG_COUNT = (segments) => (segments || []).reduce((acc, s) => acc + (s.count || 0), 0);
const TOTAL_SEG_REVENUE = (segments) => (segments || []).reduce((acc, s) => acc + (s.totalRevenue || 0), 0);

export const CLIENTES_METRICS = [
  {
    key: 'totales',
    defaultLabel: 'Clientes totales',
    info: 'Cantidad total de personas únicas que compraron alguna vez en tu tienda',
    getValue: (d) => fmtNum(d?.total),
    getSub: (d) => {
      const dormidos = SEG_COUNT(d?.segments, 'hibernating');
      const total = d?.total || TOTAL_SEG_COUNT(d?.segments);
      if (!total) return 'Sin datos';
      return `Histórico · ${fmtNum(dormidos)} dormidos (${fmtPct((dormidos / total) * 100, 0)})`;
    },
  },
  {
    key: 'vip',
    defaultLabel: 'Mejores + Fieles',
    info: 'Clientes activos con alto valor — la base VIP que sostiene el negocio',
    getValue: (d) => fmtNum(SEG_COUNT(d?.segments, 'champions') + SEG_COUNT(d?.segments, 'loyal')),
    getSub: (d) => {
      const vipCount = SEG_COUNT(d?.segments, 'champions') + SEG_COUNT(d?.segments, 'loyal');
      const vipRev = SEG_REVENUE(d?.segments, 'champions') + SEG_REVENUE(d?.segments, 'loyal');
      const total = d?.total || TOTAL_SEG_COUNT(d?.segments);
      const totalRev = TOTAL_SEG_REVENUE(d?.segments);
      if (!total) return '—';
      return `${fmtPct((vipCount / total) * 100, 0)} de la base · ${fmtMoneyShort(vipRev)} en compras (${fmtPct((vipRev / totalRev) * 100, 0)})`;
    },
    getTone: () => 'good',
  },
  {
    key: 'atRisk',
    defaultLabel: 'En riesgo a recuperar',
    info: 'Clientes valiosos que dejaron de comprar — accionar antes de que se vayan',
    getValue: (d) => fmtNum(SEG_COUNT(d?.segments, 'at_risk')),
    getSub: (d) => `${fmtMoneyShort(SEG_REVENUE(d?.segments, 'at_risk'))} en compras en juego`,
    getTone: () => 'warn',
  },
  {
    key: 'repurchase',
    defaultLabel: 'Tasa de recompra',
    info: '% de clientes que compraron más de una vez. Saludable: 20-40%. Bajo 15% indica dependencia de adquisición.',
    getValue: (d) => {
      const total = d?.total || 0;
      const repeaters = (d?.customers || []).filter((c) => (c.totalOrders || 0) > 1).length;
      if (!total) return '—';
      return fmtPct((repeaters / total) * 100, 1);
    },
    getSub: (d) => {
      const total = d?.total || 0;
      const repeaters = (d?.customers || []).filter((c) => (c.totalOrders || 0) > 1).length;
      return `${fmtNum(repeaters)} de ${fmtNum(total)} con más de 1 compra`;
    },
    getTone: (d) => {
      const total = d?.total || 0;
      const repeaters = (d?.customers || []).filter((c) => (c.totalOrders || 0) > 1).length;
      if (!total) return null;
      const pct = (repeaters / total) * 100;
      if (pct >= 20) return 'good';
      if (pct >= 15) return null;
      return 'warn';
    },
  },
  {
    key: 'avgLtv',
    defaultLabel: 'Gasto promedio',
    info: 'Promedio histórico de cuánto gastó cada cliente a lo largo de su vida',
    getValue: (d) => {
      const total = d?.total || TOTAL_SEG_COUNT(d?.segments);
      const totalRev = TOTAL_SEG_REVENUE(d?.segments);
      if (!total) return '—';
      return fmtMoney(totalRev / total);
    },
    getSub: (d) => `Sobre ${fmtMoneyShort(TOTAL_SEG_REVENUE(d?.segments))} de facturación total`,
  },
  {
    key: 'avgOrders',
    defaultLabel: 'Compras promedio',
    info: 'Promedio de cuántas órdenes hizo cada cliente en su historia',
    getValue: (d) => {
      const customers = d?.customers || [];
      if (customers.length === 0) return '—';
      const totalOrders = customers.reduce((acc, c) => acc + (c.totalOrders || 0), 0);
      return (totalOrders / customers.length).toFixed(2).replace('.', ',');
    },
    getSub: () => 'Por cliente a lo largo de su vida',
  },
  {
    key: 'avgRecency',
    defaultLabel: 'Días sin comprar (prom.)',
    info: 'Promedio de días desde la última compra. Mayor = más clientes inactivos.',
    getValue: (d) => {
      const customers = (d?.customers || []).filter((c) => c.recency != null);
      if (customers.length === 0) return '—';
      const avg = customers.reduce((acc, c) => acc + (c.recency || 0), 0) / customers.length;
      return `${Math.round(avg)}d`;
    },
    getSub: () => 'Mediana de recencia de toda la base',
  },
  {
    key: 'topConcentracion',
    defaultLabel: 'Top 10% facturación',
    info: 'Qué % de tu facturación generan tus 10% mejores clientes',
    getValue: (d) => {
      const customers = (d?.customers || []).slice().sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
      if (customers.length === 0) return '—';
      const totalRev = customers.reduce((acc, c) => acc + (c.totalSpent || 0), 0);
      if (!totalRev) return '—';
      const topN = Math.max(1, Math.floor(customers.length * 0.1));
      const topRev = customers.slice(0, topN).reduce((acc, c) => acc + (c.totalSpent || 0), 0);
      return fmtPct((topRev / totalRev) * 100, 0);
    },
    getSub: (d) => {
      const total = d?.total || (d?.customers?.length || 0);
      const topN = Math.max(1, Math.floor(total * 0.1));
      return `${fmtNum(topN)} mejores clientes`;
    },
  },
  {
    key: 'onetimers',
    defaultLabel: 'Compraron 1 sola vez',
    info: '% de clientes que hicieron una sola compra (Nuevos + Dormidos)',
    getValue: (d) => {
      const customers = d?.customers || [];
      const total = d?.total || customers.length;
      if (!total) return '—';
      const onetimers = customers.filter((c) => (c.totalOrders || 0) === 1).length;
      return fmtPct((onetimers / total) * 100, 0);
    },
    getSub: (d) => {
      const customers = d?.customers || [];
      const onetimers = customers.filter((c) => (c.totalOrders || 0) === 1).length;
      return `${fmtNum(onetimers)} clientes con una sola compra`;
    },
  },
  {
    key: 'dormidosPct',
    defaultLabel: 'Dormidos',
    info: 'Compraron una sola vez hace mucho. Grupo grande pero de bajo retorno por cliente.',
    getValue: (d) => {
      const dormidos = SEG_COUNT(d?.segments, 'hibernating');
      const total = d?.total || TOTAL_SEG_COUNT(d?.segments);
      if (!total) return '—';
      return fmtPct((dormidos / total) * 100, 0);
    },
    getSub: (d) => {
      const dormidos = SEG_COUNT(d?.segments, 'hibernating');
      return `${fmtNum(dormidos)} clientes · ${fmtMoneyShort(SEG_REVENUE(d?.segments, 'hibernating'))} histórico`;
    },
  },
];

export const CLIENTES_DEFAULTS = ['totales', 'vip', 'atRisk', 'repurchase'];
export const CLIENTES_MAX_SELECTED = 4;
