/**
 * Tabla de atribución por UTM (source / medium / campaign).
 * Solo ve órdenes con UTM cargado por el shop. Muestra "sin datos UTM"
 * cuando ninguna orden tiene utm_* — caso típico de tiendas que aún no
 * configuraron tracking.
 */

import { useState, useMemo } from 'react';

const TABS = [
  { key: 'source', label: 'Por source' },
  { key: 'medium', label: 'Por medium' },
  { key: 'campaign', label: 'Por campaña' },
];

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '$0';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}
function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '$0';
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

export default function UtmAttributionTable({ byUtmSource = [], byUtmMedium = [], byUtmCampaign = [] }) {
  const [tab, setTab] = useState('source');

  const rows = useMemo(() => {
    const src = tab === 'source' ? byUtmSource : tab === 'medium' ? byUtmMedium : byUtmCampaign;
    return [...src].sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0));
  }, [tab, byUtmSource, byUtmMedium, byUtmCampaign]);

  const totalAvailable = byUtmSource.length + byUtmMedium.length + byUtmCampaign.length;

  if (totalAvailable === 0) {
    return (
      <div className="card p-5">
        <div className="mb-3">
          <h3 className="text-white text-[15px] font-semibold">Atribución por UTM</h3>
          <p className="text-app-secondary text-[12px] mt-1">
            De qué fuente, medio o campaña vienen tus ventas
          </p>
        </div>
        <div className="rounded-lg border border-amber-500/15 bg-amber-500/[0.04] p-4">
          <p className="text-[12.5px] text-amber-200 font-medium">Sin datos UTM en el período</p>
          <p className="text-[12px] text-amber-100/80 mt-1">
            Ninguna orden trae <span className="font-mono text-[11px]">utm_source</span>,{' '}
            <span className="font-mono text-[11px]">utm_medium</span> o{' '}
            <span className="font-mono text-[11px]">utm_campaign</span> populado.
            Para activar este análisis, configurá que tus ads de Meta/Google agreguen
            parámetros UTM en la URL de destino. Mientras tanto, la atribución cruza por
            "Compras Meta vs Órdenes TN" en el embudo arriba.
          </p>
        </div>
      </div>
    );
  }

  const total = rows.reduce((s, r) => s + Number(r.revenue || 0), 0);
  const totalOrders = rows.reduce((s, r) => s + Number(r.ordenes || 0), 0);

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div>
          <h3 className="text-white text-[15px] font-semibold">Atribución por UTM</h3>
          <p className="text-app-secondary text-[12px] mt-1">
            De qué fuente, medio o campaña vienen tus ventas
          </p>
        </div>
        <div className="text-right">
          <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Cubiertas</p>
          <p className="text-white text-[16px] font-bold tabular-nums">{totalOrders}</p>
          <p className="text-app-muted text-[11px]">órdenes con UTM</p>
        </div>
      </div>

      <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] p-0.5 text-[11px] mb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-1 rounded-full transition ${tab === t.key ? 'bg-blue-500/20 text-blue-200' : 'text-gray-300 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-[0.12em] text-app-muted border-b border-white/[0.06]">
              <th className="text-left py-2 px-2 font-semibold">{TABS.find((t) => t.key === tab)?.label.replace('Por ', '')}</th>
              <th className="text-center py-2 px-2 font-semibold w-[100px]">Órdenes</th>
              <th className="text-right py-2 px-2 font-semibold w-[140px]">Revenue</th>
              {tab !== 'medium' && <th className="text-right py-2 px-2 font-semibold w-[120px]">AOV</th>}
              <th className="text-right py-2 px-2 font-semibold w-[100px]">% revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const value = Number(r.revenue || 0);
              const pct = total > 0 ? (value / total) * 100 : 0;
              return (
                <tr key={r._id || i} className="border-b border-white/[0.03] hover:bg-white/[0.015] transition">
                  <td className="py-2.5 px-2">
                    <p className="text-white text-[13px] font-medium truncate max-w-[300px]" title={r._id}>
                      {r._id || '(sin valor)'}
                    </p>
                  </td>
                  <td className="py-2.5 px-2 text-center text-app-secondary tabular-nums">{r.ordenes}</td>
                  <td className="py-2.5 px-2 text-right text-emerald-300 tabular-nums">{fmtMoney(value)}</td>
                  {tab !== 'medium' && (
                    <td className="py-2.5 px-2 text-right text-app-secondary tabular-nums">
                      {r.aov > 0 ? fmtMoneyShort(r.aov) : '—'}
                    </td>
                  )}
                  <td className="py-2.5 px-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-12 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                        <div className="h-full bg-blue-400/70 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <span className="text-app-secondary tabular-nums text-[11.5px] w-10 text-right">{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
