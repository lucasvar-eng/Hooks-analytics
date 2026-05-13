/**
 * Aging de stock — 5 buckets (0-30 / 31-60 / 61-90 / 90+ / Sin ventas) con barras horizontales.
 * Data viene de `/products/commercial` como `agingSummary`.
 *
 * Cada bucket tiene su color (fresh → frozen) y el ancho proporcional a la cantidad de productos.
 */

const BUCKET_STYLES = {
  '0-30':       { label: 'Activos',       className: 'is-fresh',  gradient: 'linear-gradient(90deg, #34d399, #10b981)' },
  '31-60':      { label: 'Tibios',        className: 'is-warm',   gradient: 'linear-gradient(90deg, #60a5fa, #3b82f6)' },
  '61-90':      { label: 'Enfriándose',   className: 'is-cool',   gradient: 'linear-gradient(90deg, #fbbf24, #f59e0b)' },
  '90+':        { label: 'Dormidos',      className: 'is-cold',   gradient: 'linear-gradient(90deg, #f87171, #ef4444)' },
  'Sin ventas': { label: 'Nunca vendieron', className: 'is-frozen', gradient: 'linear-gradient(90deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08))' },
};

const BUCKET_ORDER = ['0-30', '31-60', '61-90', '90+', 'Sin ventas'];

function fmtNum(v) {
  if (v == null || isNaN(v)) return '0';
  return Number(v).toLocaleString('es-AR');
}

export default function AgingChart({ agingSummary, totalProducts }) {
  if (!agingSummary || agingSummary.length === 0) return null;

  // Ordenar y completar buckets
  const byLabel = new Map(agingSummary.map((b) => [b.label, b]));
  const buckets = BUCKET_ORDER
    .map((label) => byLabel.get(label) || { label, products: 0, stockValue: 0 })
    .filter((b) => b.products > 0);

  const total = totalProducts || agingSummary.reduce((sum, b) => sum + (b.products || 0), 0);

  return (
    <div className="card p-5">
      <div className="mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Aging de stock</p>
        <p className="text-[12px] text-gray-200 mt-0.5">Hace cuánto cada producto vendió por última vez</p>
      </div>

      {buckets.map((bucket) => {
        const style = BUCKET_STYLES[bucket.label] || BUCKET_STYLES['0-30'];
        const pct = total > 0 ? (bucket.products / total) * 100 : 0;
        return (
          <div
            key={bucket.label}
            className="grid items-center gap-3.5 py-2"
            style={{ gridTemplateColumns: '90px 1fr 110px' }}
          >
            <div>
              <div className="text-[12px] text-white font-semibold">{bucket.label}</div>
              <div className="text-[10.5px] text-gray-300">{style.label}</div>
            </div>
            <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: style.gradient }} />
            </div>
            <div className="text-right text-[12.5px] font-semibold text-white tabular-nums">
              {fmtNum(bucket.products)} <span className="text-gray-300 font-normal text-[11px]">prod.</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
