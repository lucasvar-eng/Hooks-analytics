/**
 * Gasto vs Vendibilidad + Salud del feed DPA — capa accionable.
 * Cruza la exposición de Meta por producto × salud de inventario (stock +
 * curva de talles + rotación) para detectar gasto en productos que no se
 * pueden comprar, y muestra la composición de salud del catálogo (feed DPA).
 * Endpoints:
 *   /stores/:id/media-planning/spend-vs-sellability
 *   /stores/:id/media-planning/feed-health
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('es-AR'));
const money = (n) => (n == null ? '—' : `$${Number(n).toLocaleString('es-AR')}`);

const VERDICT = {
  'no-vendible': { cls: 'bg-red-500/15 text-red-300 border-red-500/25', label: 'No vendible' },
  reponer: { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25', label: 'Reponer' },
  sano: { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', label: 'Sano' },
  'sin-match': { cls: 'bg-white/[0.06] text-app-muted border-white/10', label: 'Sin match' },
};

function FeedDonut({ feed }) {
  if (!feed || !feed.published) return null;
  const pct = feed.pctHealthy || 0;
  return (
    <div className="card p-4 flex flex-wrap items-center gap-5">
      <div
        className="relative shrink-0"
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: `conic-gradient(#10b981 0 ${pct}%, #ef4444 ${pct}% 100%)`,
        }}
      >
        <div className="absolute inset-[16px] rounded-full bg-app-card flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-white tabular-nums">{pct}%</span>
          <span className="text-[10px] text-app-muted">sano</span>
        </div>
      </div>
      <div className="flex-1 min-w-[220px]">
        <h3 className="text-[14px] font-semibold text-white mb-2">Salud del feed DPA</h3>
        <div className="flex items-center gap-2 text-[13px] mb-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#10b981' }} />
          <b className="tabular-nums">{fmt(feed.healthy)}</b>&nbsp;productos sanos (stock + curva) · aptos para servir
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#ef4444' }} />
          <b className="tabular-nums">{fmt(feed.nonSellable)}</b>&nbsp;que el DPA puede mostrar y no se pueden comprar
        </div>
        <p className="text-[12px] text-app-muted mt-2">
          Sin stock: {fmt(feed.stockZero)} · curva rota: {fmt(feed.brokenCurve)} · stock bajo: {fmt(feed.lowStock)}.
          Restringí el product set del catálogo a los {fmt(feed.healthy)} sanos.
        </p>
      </div>
    </div>
  );
}

export default function GastoVendibilidad() {
  const { storeId } = useParams();
  const { from, to } = useSelector((s) => s.date);
  const [data, setData] = useState(null);
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    Promise.all([
      api.get(`/api/stores/${storeId}/media-planning/spend-vs-sellability`, { params: { from, to, limit: 150 } }),
      api.get(`/api/stores/${storeId}/media-planning/feed-health`),
    ])
      .then(([sv, fh]) => {
        if (!alive) return;
        setData(sv.data);
        setFeed(fh.data);
      })
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [storeId, from, to]);

  const s = data?.summary;
  const rows = data?.rows || [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Gasto vs Vendibilidad</h1>
        <p className="page-subtitle">
          ¿Estás pagando por mostrar productos que no se pueden comprar? Cruza exposición de Meta × stock + curva de talles + ventas.
        </p>
      </div>

      {loading && <div className="text-center py-12 text-app-muted">Cargando…</div>}
      {error && !loading && (
        <div className="card p-5 text-app-muted">No se pudo cargar. Verificá que la tienda tenga datos de Meta (product insights) en el período.</div>
      )}

      {!loading && !error && (
        <>
          <FeedDonut feed={feed} />

          {data && (
            <>
              {/* Banner exposición no-vendible */}
              <div className="card p-0 overflow-hidden flex flex-col sm:flex-row">
                <div className="w-1 shrink-0 bg-red-500" />
                <div className="flex-1 p-4 flex flex-wrap items-center gap-6">
                  <div>
                    <div className="text-2xl font-bold text-red-300 tabular-nums">{money(s.exposureNonSellable)}</div>
                    <div className="text-[12px] text-app-muted">exposición en productos NO vendibles</div>
                  </div>
                  <div className="pl-6 border-l border-white/[0.08]">
                    <div className="text-2xl font-bold text-amber-300 tabular-nums">{s.pctNonSellable}%</div>
                    <div className="text-[12px] text-app-muted">del total de exposición DPA</div>
                  </div>
                  <div className="pl-6 border-l border-white/[0.08]">
                    <div className="text-2xl font-bold text-white tabular-nums">{s.nonSellableCount}</div>
                    <div className="text-[12px] text-app-muted">de {s.productCount} productos pauteados</div>
                  </div>
                </div>
              </div>

              {/* Tabla */}
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-app-muted text-[11px] uppercase tracking-wide">
                        <th className="text-left font-semibold px-3 py-2.5 border-b border-white/[0.06]">Producto</th>
                        <th className="text-right font-semibold px-3 py-2.5 border-b border-white/[0.06]">Exposición DPA*</th>
                        <th className="text-right font-semibold px-3 py-2.5 border-b border-white/[0.06]">Stock</th>
                        <th className="text-right font-semibold px-3 py-2.5 border-b border-white/[0.06]">Talles c/stock</th>
                        <th className="text-right font-semibold px-3 py-2.5 border-b border-white/[0.06]">Ventas 30d</th>
                        <th className="text-left font-semibold px-3 py-2.5 border-b border-white/[0.06]">Veredicto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const v = VERDICT[r.verdict] || VERDICT['sin-match'];
                        return (
                          <tr key={r.tnProductId} className="hover:bg-white/[0.02]">
                            <td className="px-3 py-2 border-b border-white/[0.04] text-app-secondary">{r.nombre}</td>
                            <td className="px-3 py-2 border-b border-white/[0.04] text-right tabular-nums text-white">{money(r.spend)}</td>
                            <td className="px-3 py-2 border-b border-white/[0.04] text-right tabular-nums">{fmt(r.stock)}</td>
                            <td className="px-3 py-2 border-b border-white/[0.04] text-right tabular-nums text-app-muted">
                              {r.sizesInStock == null ? '—' : `${r.sizesInStock}/${r.totalSizes}`}
                            </td>
                            <td className="px-3 py-2 border-b border-white/[0.04] text-right tabular-nums">{fmt(r.ventas30dias)}</td>
                            <td className="px-3 py-2 border-b border-white/[0.04]">
                              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${v.cls}`} title={r.verdictReason}>
                                {v.label}
                              </span>
                              <span className="text-[11px] text-app-muted ml-2">{r.verdictReason}</span>
                            </td>
                          </tr>
                        );
                      })}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-app-muted">Sin datos de exposición por producto en el período.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-app-muted px-3 py-2.5 border-t border-white/[0.06]">
                  * Exposición DPA = peso relativo de aparición en ads (solapado entre productos), no pesos exactos de presupuesto.
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
