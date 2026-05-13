/**
 * Concentración por categoría — sub-barras dobles (ingresos azul vs stock amber).
 * Detecta categorías sobre/sub-representadas en stock vs ingresos.
 *
 * Data: `commercial.categoryConcentration` con
 *   { categoria, revenue, revenueSharePct, stockSharePct }
 */

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}
function fmtPct(v) {
  if (v == null || isNaN(v)) return '0,0%';
  return `${Number(v).toFixed(1).replace('.', ',')}%`;
}

export default function ConcentrationChart({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Concentración por categoría</p>
        <p className="text-[12px] text-gray-200 mt-0.5">Cuánto pesa cada categoría en ingresos vs stock</p>
      </div>

      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        const revPct = Number(item.revenueSharePct || 0);
        const stkPct = Number(item.stockSharePct || 0);
        return (
          <div key={item.categoria} className={`py-2.5 ${isLast ? '' : 'border-b border-white/[0.04]'}`}>
            <div className="flex justify-between mb-1.5">
              <span className="text-[12.5px] text-white font-semibold">{item.categoria}</span>
              <span className="text-[12.5px] font-bold text-white tabular-nums">{fmtMoney(item.revenue)}</span>
            </div>
            <div className="flex gap-1">
              <div className="h-1.5 bg-white/[0.04] rounded-full flex-1 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(revPct, 100)}%`, background: 'linear-gradient(90deg, #60a5fa, #3b82f6)' }}
                />
              </div>
              <div className="h-1.5 bg-white/[0.04] rounded-full flex-1 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(stkPct, 100)}%`, background: 'linear-gradient(90deg, #fbbf24, #f59e0b)' }}
                />
              </div>
            </div>
            <div className="flex justify-between mt-1 text-[11px] text-gray-300">
              <span>Ingresos <strong className="text-blue-300">{fmtPct(revPct)}</strong></span>
              <span>Stock <strong className="text-amber-300">{fmtPct(stkPct)}</strong></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
