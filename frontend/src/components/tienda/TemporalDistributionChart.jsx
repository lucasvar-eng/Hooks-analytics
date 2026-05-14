/**
 * Distribución de ventas por día de semana / hora del día.
 * Tabs internas:
 *  - Día de semana (1=Dom ... 7=Sáb, en TZ Argentina)
 *  - Hora del día (0-23)
 *
 * Útil para detectar mejor ventana operativa y programar ads.
 */

import { useMemo, useState } from 'react';

const DOW_LABELS = ['', 'Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']; // index 1-7 desde mongo $dayOfWeek
const HOURS = Array.from({ length: 24 }, (_, i) => i);

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

export default function TemporalDistributionChart({ byDayOfWeek = [], byHourOfDay = [] }) {
  const [tab, setTab] = useState('dow');

  const dowData = useMemo(() => {
    // Ordenar Lun-Sáb-Dom (más útil que el orden de Mongo que arranca con Dom)
    const order = [2, 3, 4, 5, 6, 7, 1]; // Lun, Mar, ..., Sáb, Dom
    const map = new Map(byDayOfWeek.map((r) => [r._id, r]));
    return order.map((id) => ({
      _id: id,
      label: DOW_LABELS[id],
      ordenes: Number(map.get(id)?.ordenes || 0),
      revenue: Number(map.get(id)?.revenue || 0),
      aov: Number(map.get(id)?.aov || 0),
    }));
  }, [byDayOfWeek]);

  const hourData = useMemo(() => {
    const map = new Map(byHourOfDay.map((r) => [r._id, r]));
    return HOURS.map((h) => ({
      _id: h,
      label: `${String(h).padStart(2, '0')}:00`,
      ordenes: Number(map.get(h)?.ordenes || 0),
      revenue: Number(map.get(h)?.revenue || 0),
    }));
  }, [byHourOfDay]);

  const rows = tab === 'dow' ? dowData : hourData;
  const totalOrders = rows.reduce((s, r) => s + r.ordenes, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const maxOrders = Math.max(...rows.map((r) => r.ordenes), 1);
  const avgOrders = totalOrders / rows.length;

  if (totalOrders === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px] text-app-secondary">Sin órdenes en el período para distribución temporal.</p>
      </div>
    );
  }

  // Encontrar los 3 mejores y peores para destacar
  const ranked = [...rows].sort((a, b) => b.ordenes - a.ordenes);
  const topThree = new Set(ranked.slice(0, 3).map((r) => r._id));
  const bottomThree = new Set(
    ranked
      .filter((r) => r.ordenes > 0)
      .slice(-3)
      .map((r) => r._id)
  );

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div>
          <h3 className="text-white text-[15px] font-semibold">Distribución temporal</h3>
          <p className="text-app-secondary text-[12px] mt-1">
            Cuándo se vende mejor — útil para programar ads y operativa
          </p>
        </div>
        <div className="text-right">
          <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Promedio</p>
          <p className="text-white text-[16px] font-bold tabular-nums">{avgOrders.toFixed(1)} órdenes</p>
        </div>
      </div>

      <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] p-0.5 text-[11px] mb-4">
        <button
          type="button"
          onClick={() => setTab('dow')}
          className={`px-3 py-1 rounded-full transition ${tab === 'dow' ? 'bg-blue-500/20 text-blue-200' : 'text-gray-300 hover:text-white'}`}
        >
          Por día
        </button>
        <button
          type="button"
          onClick={() => setTab('hour')}
          className={`px-3 py-1 rounded-full transition ${tab === 'hour' ? 'bg-blue-500/20 text-blue-200' : 'text-gray-300 hover:text-white'}`}
        >
          Por hora
        </button>
      </div>

      <div className={tab === 'hour' ? 'grid grid-cols-12 gap-1' : 'space-y-1.5'}>
        {rows.map((r) => {
          const pct = maxOrders > 0 ? (r.ordenes / maxOrders) * 100 : 0;
          const isTop = topThree.has(r._id);
          const isBottom = bottomThree.has(r._id) && !isTop && r.ordenes > 0;
          const barColor = isTop
            ? 'bg-emerald-400/70'
            : isBottom
              ? 'bg-red-400/40'
              : 'bg-blue-400/60';

          if (tab === 'hour') {
            // Vista compacta tipo heatmap
            const intensity = Math.max(pct / 100, 0.06);
            return (
              <div
                key={r._id}
                className="rounded h-12 flex flex-col items-center justify-end px-1 py-1 relative"
                style={{ background: `rgba(59, 130, 246, ${intensity})` }}
                title={`${r.label} — ${r.ordenes} órdenes · ${fmtMoney(r.revenue)}`}
              >
                <span className="text-[9px] text-white/70 absolute top-0.5">{String(r._id).padStart(2, '0')}</span>
                <span className="text-[11px] text-white font-bold tabular-nums">{r.ordenes || ''}</span>
              </div>
            );
          }

          return (
            <div key={r._id} className="grid items-center gap-3" style={{ gridTemplateColumns: '64px 1fr 120px' }}>
              <span className={`text-[12.5px] font-medium ${isTop ? 'text-emerald-300' : isBottom ? 'text-red-300' : 'text-app-secondary'}`}>
                {r.label}
              </span>
              <div className="h-7 bg-white/[0.03] rounded overflow-hidden">
                <div
                  className={`h-full ${barColor} transition-all duration-500 flex items-center justify-end pr-2`}
                  style={{ width: `${Math.max(pct, 4)}%` }}
                >
                  <span className="text-[11px] font-bold text-white tabular-nums">{r.ordenes}</span>
                </div>
              </div>
              <span className="text-right text-app-secondary text-[12px] tabular-nums">{fmtMoneyShort(r.revenue)}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center gap-4 text-[11px] text-app-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-emerald-400/70" />
          Top 3
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-blue-400/60" />
          Resto
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-red-400/40" />
          Bottom 3
        </span>
        <span className="ml-auto">{totalOrders} órdenes · {fmtMoneyShort(totalRevenue)}</span>
      </div>
    </div>
  );
}
