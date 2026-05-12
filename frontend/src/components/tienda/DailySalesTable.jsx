/**
 * Tabla de detalle por día — la más rica para entender qué pasó día a día.
 * Reemplaza la tabla de top clientes (que vive en /clientes).
 *
 * Por cada fila: día (DOW + dd/mm) · revenue · órdenes · AOV · NC vs RC ·
 * % del total del período · barra inline de share visual.
 */

import { useMemo } from 'react';

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}
function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '$0';
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

function parseDate(s) {
  if (!s) return null;
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}
function dayOfWeek(s) {
  const d = parseDate(s);
  return d ? DOW[d.getDay()] : '';
}
function isToday(s) {
  const d = parseDate(s);
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
function isWeekend(s) {
  const d = parseDate(s);
  if (!d) return false;
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

export default function DailySalesTable({ data = [] }) {
  const rows = useMemo(() => {
    const sorted = [...(data || [])].sort((a, b) => String(b._id).localeCompare(String(a._id)));
    const totalRevenue = sorted.reduce((s, d) => s + Number(d.revenue || 0), 0);
    const totalOrders = sorted.reduce((s, d) => s + Number(d.ordenes || 0), 0);
    const maxRevenue = Math.max(...sorted.map((d) => Number(d.revenue || 0)), 1);
    return sorted.map((d) => {
      const revenue = Number(d.revenue || 0);
      const ordenes = Number(d.ordenes || 0);
      const ncOrdenes = Number(d.ncOrdenes || 0);
      const rcOrdenes = Number(d.rcOrdenes || 0);
      return {
        ...d,
        revenue,
        ordenes,
        ncOrdenes,
        rcOrdenes,
        aov: ordenes > 0 ? revenue / ordenes : 0,
        netRevenue: Number(d.netRevenue || 0),
        sharePct: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
        ordersSharePct: totalOrders > 0 ? (ordenes / totalOrders) * 100 : 0,
        revShare: revenue / maxRevenue,
        ncRatio: ordenes > 0 ? ncOrdenes / ordenes : 0,
      };
    });
  }, [data]);

  if (rows.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px] text-app-secondary">Sin actividad en el período.</p>
      </div>
    );
  }

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalOrders = rows.reduce((s, r) => s + r.ordenes, 0);
  const totalNet = rows.reduce((s, r) => s + r.netRevenue, 0);
  const totalNc = rows.reduce((s, r) => s + r.ncOrdenes, 0);
  const totalRc = rows.reduce((s, r) => s + r.rcOrdenes, 0);

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h3 className="text-white text-[15px] font-semibold">Detalle por día</h3>
          <p className="text-app-secondary text-[12px] mt-1">Ordenado por fecha · más reciente arriba</p>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-app-secondary">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-400" />
            NC = nuevo
          </span>
          <span className="inline-flex items-center gap-1.5 text-app-secondary">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-400" />
            RC = recurrente
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.16em] text-app-muted">
              <th className="text-left font-semibold pb-3 pr-3">Día</th>
              <th className="text-right font-semibold pb-3 pr-3">Facturación</th>
              <th className="text-right font-semibold pb-3 pr-3">% del período</th>
              <th className="text-right font-semibold pb-3 pr-3">Órdenes</th>
              <th className="text-right font-semibold pb-3 pr-3">AOV</th>
              <th className="text-right font-semibold pb-3 pr-3">Neto</th>
              <th className="text-left font-semibold pb-3 pr-3 pl-2">NC / RC</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const today = isToday(row._id);
              const weekend = isWeekend(row._id);
              return (
                <tr
                  key={row._id}
                  className="border-t border-white/[0.04] hover:bg-white/[0.015] transition"
                >
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2.5">
                      {today && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                      <div>
                        <p className={`text-[13px] font-medium tabular-nums ${today ? 'text-amber-300' : 'text-white'}`}>
                          {row._id?.split('-').slice(1).reverse().join('/')}
                        </p>
                        <p className={`text-[11px] mt-0.5 ${weekend ? 'text-purple-300' : 'text-app-muted'}`}>
                          {dayOfWeek(row._id)}{today && ' · hoy'}{weekend && !today && ' · finde'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <p className="text-white text-[14px] font-semibold tabular-nums">{fmtMoney(row.revenue)}</p>
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <div className="flex items-center justify-end gap-2.5">
                      <div className="w-16 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-400"
                          style={{ width: `${row.revShare * 100}%` }}
                        />
                      </div>
                      <span className="text-app-secondary text-[12px] tabular-nums w-10 text-right">{row.sharePct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <p className="text-amber-300 text-[14px] font-semibold tabular-nums">{row.ordenes}</p>
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <p className="text-app-secondary text-[12px] tabular-nums">{fmtMoneyShort(row.aov)}</p>
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <p className="text-app-secondary text-[12px] tabular-nums">{fmtMoneyShort(row.netRevenue)}</p>
                  </td>
                  <td className="py-3 pr-3 pl-2">
                    <div className="flex items-center gap-2">
                      <div className="flex w-24 h-2 rounded-full overflow-hidden bg-white/[0.04]">
                        {row.ordenes > 0 && (
                          <>
                            <div className="bg-blue-400" style={{ width: `${row.ncRatio * 100}%` }} />
                            <div className="bg-emerald-400" style={{ width: `${(1 - row.ncRatio) * 100}%` }} />
                          </>
                        )}
                      </div>
                      <span className="text-[12px] tabular-nums">
                        <span className="text-blue-300 font-semibold">{row.ncOrdenes}</span>
                        <span className="text-app-muted mx-1">/</span>
                        <span className="text-emerald-300 font-semibold">{row.rcOrdenes}</span>
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {/* Total row */}
            <tr className="border-t-2 border-white/[0.08]">
              <td className="py-3 pr-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-app-muted font-semibold">Total · {rows.length} días</p>
              </td>
              <td className="py-3 pr-3 text-right">
                <p className="text-white text-[15px] font-bold tabular-nums">{fmtMoney(totalRevenue)}</p>
              </td>
              <td className="py-3 pr-3 text-right">
                <p className="text-app-muted text-[12px] tabular-nums">100%</p>
              </td>
              <td className="py-3 pr-3 text-right">
                <p className="text-amber-300 text-[15px] font-bold tabular-nums">{totalOrders.toLocaleString('es-AR')}</p>
              </td>
              <td className="py-3 pr-3 text-right">
                <p className="text-app-secondary text-[12px] tabular-nums">{fmtMoneyShort(totalOrders > 0 ? totalRevenue / totalOrders : 0)}</p>
              </td>
              <td className="py-3 pr-3 text-right">
                <p className="text-app-secondary text-[12px] tabular-nums">{fmtMoneyShort(totalNet)}</p>
              </td>
              <td className="py-3 pr-3 pl-2">
                <span className="text-[12px] tabular-nums">
                  <span className="text-blue-300 font-bold">{totalNc}</span>
                  <span className="text-app-muted mx-1">/</span>
                  <span className="text-emerald-300 font-bold">{totalRc}</span>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
