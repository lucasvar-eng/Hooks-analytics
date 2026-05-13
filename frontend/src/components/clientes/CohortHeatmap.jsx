import { useMemo } from 'react';

/**
 * Heatmap de retención por cohorte (mes de alta).
 *
 * Recibe el array del backend `/customers/cohorts`:
 *   [{ cohortMonth, total, retention: { 0: 100, 1: 25, ... } }]
 *
 * Renderiza con celdas coloreadas según %: gris → azul → verde.
 * Limita columnas a M0..M11 (12 meses).
 */

const MAX_MONTHS = 12;

function bucketClass(pct) {
  if (pct == null || pct === 0) return 'bg-white/[0.02] text-gray-300';
  if (pct >= 50) return 'bg-emerald-500/40 text-white font-bold';
  if (pct >= 20) return 'bg-blue-500/30 text-blue-100 font-semibold';
  if (pct >= 10) return 'bg-blue-500/18 text-blue-200';
  if (pct >= 5) return 'bg-blue-500/10 text-gray-100';
  if (pct >= 1) return 'bg-blue-500/[0.06] text-gray-100';
  return 'bg-white/[0.02] text-gray-300';
}

export default function CohortHeatmap({ cohorts }) {
  const rows = useMemo(() => {
    if (!cohorts || cohorts.length === 0) return [];
    // Solo cohorts con al menos 3 clientes (evita ruido de muestras chicas)
    return [...cohorts]
      .filter((c) => (c.total || 0) >= 3)
      .sort((a, b) => (b.cohortMonth || '').localeCompare(a.cohortMonth || ''))
      .slice(0, 12); // últimos 12 cohorts
  }, [cohorts]);

  const months = useMemo(() => {
    if (rows.length === 0) return [];
    let max = 0;
    rows.forEach((r) => {
      Object.keys(r.retention || {}).forEach((k) => {
        const n = Number(k);
        if (!isNaN(n) && n > max) max = n;
      });
    });
    return Array.from({ length: Math.min(max + 1, MAX_MONTHS) }, (_, i) => i);
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="card p-6">
        <p className="text-gray-300 text-[13px] text-center py-6">Sin cohortes suficientes para analizar retención.</p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex justify-between items-baseline mb-4 flex-wrap gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">
            Retención por mes de alta · Cohortes
            <span
              title="% de clientes que volvieron a comprar N meses después de su primera compra"
              className="ml-1.5 inline-flex items-center justify-center w-[14px] h-[14px] rounded-full bg-white/[0.08] text-gray-300 text-[9px] font-bold cursor-help align-middle"
            >i</span>
          </p>
          <p className="text-[12px] text-gray-200 mt-1">
            % de clientes que volvieron a comprar N meses después de su primera compra
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: '2px' }}>
          <thead>
            <tr>
              <th className="text-left text-[10px] font-bold uppercase tracking-[0.6px] text-gray-300 px-2 py-1.5 whitespace-nowrap">Mes de alta</th>
              <th className="text-center text-[10px] font-bold uppercase tracking-[0.6px] text-gray-300 px-2 py-1.5">Total</th>
              {months.map((m) => (
                <th key={m} className="text-center text-[10px] font-bold uppercase tracking-[0.6px] text-gray-300 px-2 py-1.5">
                  M{m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cohortMonth}>
                <td className="text-left text-white font-medium text-[12px] px-2.5 py-1.5 whitespace-nowrap">
                  {r.cohortMonth}
                </td>
                <td className="text-center text-white font-semibold text-[12px] px-2.5 py-1.5">{r.total}</td>
                {months.map((m) => {
                  const val = r.retention?.[m];
                  return (
                    <td
                      key={m}
                      className={`text-center text-[11.5px] px-2.5 py-1.5 rounded ${bucketClass(val)}`}
                      style={{ minWidth: '46px' }}
                    >
                      {val != null && val > 0 ? `${val.toFixed(0)}%` : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
