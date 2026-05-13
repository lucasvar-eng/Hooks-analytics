import { useMemo } from 'react';

/**
 * Concentración de facturación · Pareto.
 *
 * Calcula en cliente qué % del total acumulan los top 1/5/10/20/50%.
 * Muestra barras + dos insights destacados:
 *  - Regla 80/20 (top 20% → X%)
 *  - Top 10% vs Dormidos (compara con segmento hibernating)
 */
function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '—';
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
function fmtPct(v, digits = 0) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(digits).replace('.', ',')}%`;
}
function fmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('es-AR');
}

const PERCENTILES = [1, 5, 10, 20, 50, 100];

export default function ParetoCard({ customers, segments }) {
  const data = useMemo(() => {
    const sorted = (customers || [])
      .map((c) => c.totalSpent || 0)
      .filter((v) => v > 0)
      .sort((a, b) => b - a);

    if (sorted.length === 0) {
      return { totalRevenue: 0, total: 0, rows: [] };
    }

    const total = sorted.length;
    const totalRevenue = sorted.reduce((acc, v) => acc + v, 0);

    let cumulative = 0;
    const rows = PERCENTILES.map((pct) => {
      const n = pct === 100 ? total : Math.max(1, Math.floor((total * pct) / 100));
      let revenueAt = 0;
      for (let i = 0; i < n; i++) revenueAt += sorted[i];
      cumulative = revenueAt;
      return {
        pct,
        count: n,
        revenue: revenueAt,
        revenuePct: totalRevenue > 0 ? (revenueAt / totalRevenue) * 100 : 0,
      };
    });

    return { totalRevenue, total, rows };
  }, [customers]);

  // Insight 80/20
  const top20 = data.rows.find((r) => r.pct === 20);
  const top10 = data.rows.find((r) => r.pct === 10);

  // Comparación top 10 vs dormidos
  const dormidos = (segments || []).find((s) => s._id === 'hibernating');
  const dormidosRevenue = dormidos?.totalRevenue || 0;
  const dormidosCount = dormidos?.count || 0;

  if (data.total === 0) {
    return (
      <div className="card p-6">
        <p className="text-gray-300 text-[13px] text-center py-6">Sin datos para calcular concentración.</p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex justify-between items-baseline mb-5 flex-wrap gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">
            Concentración de facturación
            <span
              title="Qué % de tu facturación generan los clientes top — base de la regla 80/20"
              className="ml-1.5 inline-flex items-center justify-center w-[14px] h-[14px] rounded-full bg-white/[0.08] text-gray-300 text-[9px] font-bold cursor-help align-middle"
            >i</span>
          </p>
          <p className="text-[12px] text-gray-200 mt-1">
            Qué % de tus clientes generaron qué % de tu facturación histórica ({fmtMoneyShort(data.totalRevenue)} total)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Barras */}
        <div className="flex flex-col gap-2.5">
          {data.rows.map((r) => (
            <div key={r.pct} className="grid items-center gap-3" style={{ gridTemplateColumns: '90px 1fr 140px' }}>
              <span className="text-[11.5px] text-gray-200 font-medium">
                {r.pct === 100 ? '100%' : `Top ${r.pct}%`}
              </span>
              <div className="bg-white/[0.04] rounded-md h-4 overflow-hidden relative">
                <div
                  className="h-full rounded-md"
                  style={{
                    width: `${r.revenuePct}%`,
                    background: 'linear-gradient(90deg, rgba(96,165,250,0.5), rgba(96,165,250,0.85))',
                  }}
                />
              </div>
              <span className="text-[11.5px] text-white font-bold text-right tabular-nums whitespace-nowrap">
                {fmtMoneyShort(r.revenue)} · {fmtPct(r.revenuePct, 0)}
              </span>
            </div>
          ))}
        </div>

        {/* Insights */}
        <div className="flex flex-col gap-3">
          {top20 && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-blue-300">Regla 80/20</p>
              <p className="text-[24px] font-bold text-white mt-1 leading-none">
                20% → {fmtPct(top20.revenuePct, 0)}
              </p>
              <p className="text-[11.5px] text-gray-200 mt-2 leading-snug">
                Tus {fmtNum(top20.count)} mejores clientes generaron más de la mitad de tu facturación. Cada cliente top vale en promedio {fmtMoneyShort(top20.revenue / top20.count)} a lo largo de su vida.
              </p>
            </div>
          )}
          {top10 && dormidosCount > 0 && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.6px] text-blue-300">Top 10% vs Dormidos</p>
              <p className="text-[24px] font-bold text-white mt-1 leading-none">
                {fmtMoneyShort(top10.revenue)} vs {fmtMoneyShort(dormidosRevenue)}
              </p>
              <p className="text-[11.5px] text-gray-200 mt-2 leading-snug">
                Los {fmtNum(top10.count)} mejores te dan {top10.revenue >= dormidosRevenue ? 'más' : 'menos'} que los {fmtNum(dormidosCount)} dormidos. Invertí donde rinde.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
