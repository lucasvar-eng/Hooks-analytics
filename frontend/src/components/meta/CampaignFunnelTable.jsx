/**
 * Embudo por campaña — desglose de conversión por campaña.
 * Complementa el embudo global (no lo reemplaza): muestra dónde se cae CADA
 * campaña (clic→ATC, ATC→checkout, checkout→compra) para detectar que el
 * cuello no siempre es el mismo. Se alimenta de los datos de campañas que la
 * página Meta Ads ya trae (metrics por campaña).
 */

import { useMemo } from 'react';

const rate = (a, b) => (b > 0 ? (100 * a) / b : null);
const fpct = (v) => (v == null ? '—' : `${v.toFixed(1)}%`);
const money = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;
const roasCls = (r) => (r >= 2.5 ? 'text-emerald-400' : r > 0 && r < 2 ? 'text-red-400' : 'text-app-secondary');

export default function CampaignFunnelTable({ campaigns }) {
  const rows = useMemo(
    () =>
      (campaigns || [])
        .map((c) => {
          const m = c.metrics || {};
          const lc = m.linkClicks || m.clicks || 0;
          return {
            id: c.metaId,
            nombre: c.nombre,
            status: c.status,
            spend: m.spend || 0,
            roas: m.roas || 0,
            c2atc: rate(m.atc || 0, lc),
            atc2co: rate(m.checkouts || 0, m.atc || 0),
            co2pur: rate(m.purchases || 0, m.checkouts || 0),
          };
        })
        .filter((r) => r.spend > 0)
        .sort((a, b) => b.spend - a.spend),
    [campaigns]
  );

  if (!rows.length) return null;

  // El paso con menor conversión de cada fila se marca como su cuello.
  const weakest = (r) => {
    const steps = [
      ['c2atc', r.c2atc],
      ['atc2co', r.atc2co],
      ['co2pur', r.co2pur],
    ].filter(([, v]) => v != null);
    if (!steps.length) return null;
    return steps.reduce((min, s) => (s[1] < min[1] ? s : min))[0];
  };

  const cell = (r, key, val) => (
    <td className={`px-3 py-2 border-b border-white/[0.04] text-right tabular-nums ${weakest(r) === key ? 'text-red-400 font-semibold' : 'text-app-secondary'}`}>
      {fpct(val)}
    </td>
  );

  return (
    <div className="card p-0 overflow-hidden">
      <div className="p-4 border-b border-white/[0.06]">
        <h3 className="text-white text-[14px] font-semibold">Embudo por campaña</h3>
        <p className="text-app-secondary text-[12px] mt-0.5">Dónde se cae cada campaña. El paso en rojo es el cuello de esa campaña.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-app-muted text-[11px] uppercase tracking-wide">
              <th className="text-left font-semibold px-3 py-2.5 border-b border-white/[0.06]">Campaña</th>
              <th className="text-right font-semibold px-3 py-2.5 border-b border-white/[0.06]">Spend</th>
              <th className="text-right font-semibold px-3 py-2.5 border-b border-white/[0.06]">ROAS</th>
              <th className="text-right font-semibold px-3 py-2.5 border-b border-white/[0.06]">Clic→ATC</th>
              <th className="text-right font-semibold px-3 py-2.5 border-b border-white/[0.06]">ATC→Checkout</th>
              <th className="text-right font-semibold px-3 py-2.5 border-b border-white/[0.06]">Checkout→Compra</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-white/[0.02]">
                <td className="px-3 py-2 border-b border-white/[0.04] text-app-secondary">
                  {r.nombre}
                  {r.status && r.status !== 'ACTIVE' && (
                    <span className="ml-2 text-[10px] text-app-muted uppercase">{r.status}</span>
                  )}
                </td>
                <td className="px-3 py-2 border-b border-white/[0.04] text-right tabular-nums text-white">{money(r.spend)}</td>
                <td className={`px-3 py-2 border-b border-white/[0.04] text-right tabular-nums font-semibold ${roasCls(r.roas)}`}>{r.roas.toFixed(2)}x</td>
                {cell(r, 'c2atc', r.c2atc)}
                {cell(r, 'atc2co', r.atc2co)}
                {cell(r, 'co2pur', r.co2pur)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
