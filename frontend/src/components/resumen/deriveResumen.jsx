/**
 * Fase 1: deriva alertas + highlights desde la data ya disponible en frontend.
 * Cuando exista endpoint backend dedicado (Fase 2), reemplazar estas funciones
 * por consumo del endpoint sin cambiar la firma.
 */

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '$0';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}

/**
 * Genera array de alertas accionables + oportunidades.
 *
 * Inputs:
 *   metrics: state.stores.metrics[storeId] (objeto con current, deltas, costCoverage, ...)
 *   productOverview: opcional, response de /products/overview con summary, deadStock, etc.
 *   campaigns: opcional, lista de campañas Meta del período
 *   storeId: para construir CTAs
 */
export function deriveAlerts({ metrics, productOverview, campaigns, storeId }) {
  const alerts = [];
  if (!metrics) return alerts;

  const current = metrics.current || {};
  const deltas = metrics.deltas || {};
  const coverage = metrics.costCoverage;

  // 1. Cobertura de costos en 0% → margen estimado (warn)
  if (coverage?.isPreliminary && coverage.coveragePct < 20) {
    const missingLabels = (coverage.missing || []).map((k) => coverage.components?.[k]?.label).filter(Boolean);
    alerts.push({
      id: 'cost-coverage',
      severity: 'warn',
      source: 'Costos',
      text: `Cobertura <strong>${coverage.coveragePct}%</strong> · margen estimado, no real`,
      detail: missingLabels.length > 0 ? (
        <div>
          <p className="text-[12px] text-app-secondary mb-2">Faltan cargar para tener margen real:</p>
          <div className="flex flex-wrap gap-1.5">
            {missingLabels.map((l) => (
              <span key={l} className="text-[11px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-app-primary">{l}</span>
            ))}
          </div>
        </div>
      ) : null,
      ctaLabel: 'Cargar',
      ctaTo: `/store/${storeId}/costos`,
    });
  }

  // 2. ROAS bajó significativamente vs período anterior (danger)
  if (deltas.roas != null && deltas.roas < -20) {
    alerts.push({
      id: 'roas-drop',
      severity: 'danger',
      source: 'Meta Ads',
      text: `ROAS cayó <strong>${Math.abs(deltas.roas).toFixed(1)}%</strong> vs período anterior`,
      ctaLabel: 'Ver',
      ctaTo: `/store/${storeId}/meta-ads`,
    });
  }

  // 3. Dead stock alto en productos (info)
  if (productOverview?.summary?.deadStockCount > 50) {
    const top = (productOverview.deadStock || []).slice(0, 5);
    alerts.push({
      id: 'dead-stock',
      severity: 'info',
      source: 'Productos',
      text: `<strong>${productOverview.summary.deadStockCount}</strong> productos en dead stock · ${productOverview.summary.deadStockCount > productOverview.summary.totalProducts * 0.5 ? 'definición muy laxa' : 'revisar liquidación'}`,
      detail: top.length > 0 ? (
        <table className="resumen-mini-table">
          <thead>
            <tr>
              <th>Top dead stock</th>
              <th className="right">Stock</th>
              <th className="right">Días sin venta</th>
              <th className="right">Stock valorizado</th>
            </tr>
          </thead>
          <tbody>
            {top.map((p) => (
              <tr key={p._id || p.nombre}>
                <td>{p.nombre}</td>
                <td className="right">{p.stock || 0}</td>
                <td className="right">{p.lastSaleDays != null ? `${p.lastSaleDays} d` : '—'}</td>
                <td className="right">{p.stockValue > 0 ? fmtMoney(p.stockValue) : <span className="muted">sin costo</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null,
      footerNote: `+ ${Math.max(0, productOverview.summary.deadStockCount - top.length)} más`,
      ctaLabel: 'Ver todos',
      ctaTo: `/store/${storeId}/productos`,
    });
  }

  // 4. Productos agotados con spend (danger) — requiere productOverview.stockout o similar
  const agotados = (productOverview?.stockout || []).filter((p) => (p.stock || 0) === 0);
  if (agotados.length > 0) {
    alerts.push({
      id: 'stockout-with-spend',
      severity: 'danger',
      source: 'Productos',
      text: `<strong>${agotados.length}</strong> ${agotados.length === 1 ? 'producto agotado' : 'productos agotados'} · revisar feed Meta`,
      ctaLabel: 'Ver',
      ctaTo: `/store/${storeId}/productos`,
    });
  }

  // 5. Campañas con ROAS = 0 pero spend significativo (danger)
  const zeroRoasCampaigns = (campaigns || []).filter((c) => {
    const m = c.metrics || c;
    return (m.spend || 0) > 50000 && (m.roas == null || m.roas === 0);
  });
  if (zeroRoasCampaigns.length > 0) {
    alerts.push({
      id: 'zero-roas-campaigns',
      severity: 'danger',
      source: 'Meta Ads',
      text: `<strong>${zeroRoasCampaigns.length}</strong> ${zeroRoasCampaigns.length === 1 ? 'campaña' : 'campañas'} con spend pero ROAS 0`,
      detail: (
        <table className="resumen-mini-table">
          <thead>
            <tr>
              <th>Campaña</th>
              <th className="right">Spend</th>
              <th className="right">Compras</th>
              <th className="right">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {zeroRoasCampaigns.slice(0, 5).map((c) => {
              const m = c.metrics || c;
              return (
                <tr key={c._id || c.metaId || c.nombre}>
                  <td>{c.nombre || c.name}</td>
                  <td className="right danger">{fmtMoney(m.spend)}</td>
                  <td className="right">{m.purchases || 0}</td>
                  <td className="right danger">0.00x</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ),
      ctaLabel: 'Ver',
      ctaTo: `/store/${storeId}/meta-ads`,
    });
  }

  // 6. Sin retención (info) → muchos NC, pocos RC
  if (current.ncPct != null && current.ncPct > 90 && (current.ordenesPositivas || 0) > 10) {
    alerts.push({
      id: 'low-retention',
      severity: 'info',
      source: 'Clientes',
      text: `<strong>${current.ncPct.toFixed(0)}% NC</strong> · prácticamente sin retención · revisar segmentos At Risk`,
      ctaLabel: 'Ver segmentos',
      ctaTo: `/store/${storeId}/clientes`,
    });
  }

  return alerts;
}

/**
 * Top productos del período (highlights[0]).
 */
export function buildTopSellersRows(productOverview, limit = 5) {
  const items = productOverview?.topSellers || [];
  return items.slice(0, limit).map((p, i) => ({
    rank: i + 1,
    name: p.nombre,
    value: fmtMoney(p.periodRevenue),
  }));
}

/**
 * Campañas mejores y peores (highlights[1]).
 * Filtra solo campañas con spend > 0 en el período.
 */
export function buildCampaignsRows(campaigns = [], limit = 5) {
  if (!campaigns || campaigns.length === 0) return [];
  // Normalizar: data viene como c.metrics.{spend,roas,...}; c.nombre
  const normalized = campaigns
    .map((c) => ({
      name: c.nombre || c.name,
      spend: c.metrics?.spend ?? c.spend ?? 0,
      roas: c.metrics?.roas ?? c.roas ?? 0,
    }))
    .filter((c) => c.spend > 0);

  if (normalized.length === 0) return [];

  const sorted = [...normalized].sort((a, b) => b.roas - a.roas);
  const best = sorted.slice(0, 2);
  const worst = sorted[sorted.length - 1];
  const rows = [];
  best.forEach((c) => rows.push({
    rank: '↑',
    rankTone: 'success',
    name: c.name,
    value: `${c.roas.toFixed(2)}x`,
    valueTone: 'success',
  }));
  if (worst && !best.includes(worst)) {
    rows.push({
      rank: worst.roas === 0 ? '↓' : '~',
      rankTone: worst.roas === 0 ? 'danger' : 'warn',
      name: worst.name,
      value: `${worst.roas.toFixed(2)}x`,
      valueTone: worst.roas === 0 ? 'danger' : 'warn',
    });
  }
  rows.push({
    rank: '—',
    name: `${normalized.length} ${normalized.length === 1 ? 'campaña activa' : 'campañas activas'}`,
    value: '',
  });
  return rows.slice(0, limit);
}

/**
 * Stock crítico (highlights[2]).
 */
export function buildStockRows(productOverview, limit = 5) {
  const summary = productOverview?.summary;
  if (!summary) return [];
  const stockout = (productOverview.stockout || []).filter((p) => (p.stock || 0) === 0).slice(0, 2);
  const lowStock = (productOverview.stockout || []).filter((p) => (p.stock || 0) > 0).slice(0, 2);
  const rows = [];
  stockout.forEach((p) => rows.push({
    rank: '!',
    rankTone: 'danger',
    name: p.nombre,
    meta: 'agotado',
    value: '0',
    valueTone: 'danger',
  }));
  lowStock.forEach((p) => rows.push({
    rank: '⚠',
    rankTone: 'warn',
    name: p.nombre,
    value: String(p.stock),
  }));
  const totalLow = (summary.stockoutCount || 0);
  if (totalLow > rows.length) {
    rows.push({
      rank: '—',
      name: `${totalLow} con stock bajo`,
      value: '',
    });
  }
  return rows.slice(0, limit);
}
