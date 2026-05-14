/**
 * Heatmap producto × mes: top N productos del último año con unidades
 * vendidas mes a mes. Como la planilla GERF.
 *
 * Independiente del rango de fechas seleccionado en el header — siempre
 * muestra los últimos 12 meses para detectar tendencias.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';

const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function shortMonth(ym) {
  if (!ym) return '';
  const [year, m] = ym.split('-');
  const monthIdx = Math.max(0, Math.min(11, parseInt(m, 10) - 1));
  return `${MONTH_SHORT[monthIdx]} ${year.slice(-2)}`;
}

function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '$0';
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

export default function ProductMonthlyHeatmap() {
  const { storeId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(null); // { productId, month, units, revenue }

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    api.get(`/api/stores/${storeId}/products/monthly-matrix?months=12&top=20`)
      .then(({ data }) => { if (!cancelled) setData(data); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [storeId]);

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px] text-app-secondary">Cargando matriz de productos...</p>
      </div>
    );
  }
  if (!data || !data.products?.length) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px] text-app-secondary">Sin productos con ventas en los últimos 12 meses.</p>
      </div>
    );
  }

  const { months, products, totalProductsWithSales } = data;

  // Máximo absoluto para escalar la intensidad del color
  const maxUnits = products.reduce((max, p) => {
    return Math.max(max, ...Object.values(p.monthly || {}).map((v) => v.units || 0));
  }, 1);

  // Total por mes (suma de los top products mostrados)
  const totalByMonth = months.map((m) => {
    return products.reduce((sum, p) => sum + (p.monthly?.[m]?.units || 0), 0);
  });

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h3 className="text-white text-[15px] font-semibold">Matriz producto × mes</h3>
          <p className="text-app-secondary text-[12px] mt-1">
            Top {products.length} productos por revenue · unidades vendidas mes a mes (últimos 12 meses)
          </p>
        </div>
        <div className="text-right">
          <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Productos con ventas</p>
          <p className="text-white text-[16px] font-bold tabular-nums">{totalProductsWithSales}</p>
        </div>
      </div>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-[11.5px] tabular-nums">
          <thead>
            <tr className="text-app-muted">
              <th className="text-left py-2 px-2 font-semibold w-[280px] sticky left-0 bg-[var(--bg-card)]">Producto</th>
              {months.map((m) => (
                <th key={m} className="text-center py-2 px-1 font-semibold w-[60px]">{shortMonth(m)}</th>
              ))}
              <th className="text-right py-2 px-2 font-semibold w-[80px]">Total</th>
              <th className="text-right py-2 px-2 font-semibold w-[80px]">Stock</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.tnProductId} className="border-t border-white/[0.04]">
                <td className="py-2 px-2 sticky left-0 bg-[var(--bg-card)]">
                  <div className="flex items-center gap-2 min-w-0">
                    {p.imagenUrl ? (
                      <img src={p.imagenUrl} alt="" className="w-7 h-7 rounded object-cover shrink-0 border border-white/[0.06]" />
                    ) : (
                      <div className="w-7 h-7 rounded bg-white/[0.05] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-white text-[12px] font-medium truncate" title={p.nombre}>{p.nombre}</p>
                      {p.categoria && (
                        <p className="text-app-muted text-[10px] truncate">{p.categoria}</p>
                      )}
                    </div>
                  </div>
                </td>
                {months.map((m) => {
                  const cell = p.monthly?.[m];
                  const units = cell?.units || 0;
                  const intensity = units > 0 ? Math.max(0.08, Math.min(1, units / maxUnits)) : 0;
                  const isHovered = hovered?.productId === p.tnProductId && hovered?.month === m;
                  return (
                    <td
                      key={m}
                      className="text-center p-0"
                      onMouseEnter={() => units > 0 && setHovered({ productId: p.tnProductId, month: m, units, revenue: cell?.revenue || 0, nombre: p.nombre })}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <div
                        className={`mx-0.5 my-0.5 rounded h-7 flex items-center justify-center text-white font-semibold transition ${
                          units === 0 ? 'text-app-muted/40' : ''
                        } ${isHovered ? 'ring-2 ring-blue-400' : ''}`}
                        style={{
                          background: units > 0
                            ? `rgba(59, 130, 246, ${intensity})`
                            : 'rgba(255,255,255,0.02)',
                        }}
                      >
                        {units > 0 ? units : '·'}
                      </div>
                    </td>
                  );
                })}
                <td className="text-right py-2 px-2 text-emerald-300 font-bold">{p.totalUnits}</td>
                <td className="text-right py-2 px-2 text-app-secondary">{p.stock || 0}</td>
              </tr>
            ))}
            {/* Fila total */}
            <tr className="border-t border-white/[0.08] bg-white/[0.02]">
              <td className="py-2 px-2 text-app-muted text-[11px] uppercase tracking-wider font-semibold sticky left-0 bg-[var(--bg-card)]">Total top</td>
              {totalByMonth.map((t, i) => (
                <td key={i} className="text-center py-2 px-1 text-white font-bold">{t || '·'}</td>
              ))}
              <td className="text-right py-2 px-2 text-emerald-300 font-bold">
                {products.reduce((s, p) => s + p.totalUnits, 0)}
              </td>
              <td className="text-right py-2 px-2 text-app-secondary">
                {products.reduce((s, p) => s + (p.stock || 0), 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Tooltip hover */}
      {hovered && (
        <div className="mt-3 px-3 py-2 rounded-md bg-white/[0.04] border border-white/[0.08] text-[12px]">
          <span className="text-white font-medium">{hovered.nombre}</span>
          <span className="text-app-muted mx-1.5">·</span>
          <span className="text-app-secondary">{shortMonth(hovered.month)}</span>
          <span className="text-app-muted mx-1.5">·</span>
          <span className="text-emerald-300">{hovered.units} unid.</span>
          <span className="text-app-muted mx-1.5">·</span>
          <span className="text-blue-300">{fmtMoneyShort(hovered.revenue)}</span>
        </div>
      )}
    </div>
  );
}
