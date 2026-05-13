/**
 * Barra apilada que muestra la proporción del catálogo por estado de rotación.
 * Cuatro segmentos: vendidos · activos sin venta · sin movimiento >90d · sin stock.
 *
 * Bajada de la versión "hero" del boceto v1 a un bloque secundario (Lucas pidió
 * que la tabla sea lo primero, no esta barra).
 */

function fmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('es-AR');
}

function fmtPct(part, total) {
  if (!total || total <= 0) return '0%';
  return `${((part / total) * 100).toFixed(1).replace('.', ',')}%`;
}

export default function CatalogHealth({ products, summary }) {
  if (!products || !summary) return null;

  const total = summary.totalProducts || products.length;
  // Buckets exclusivos para que la suma cierre con total:
  // - Sin stock (prioridad operativa más alta — incluso si vendió)
  // - Vendidos = vendió Y tiene stock > 0
  // - Sin movimiento = no vendió Y tiene stock > 0
  const out = products.filter((p) => (p.stock || 0) === 0).length;
  const sold = products.filter((p) => (p.periodSales || 0) > 0 && (p.stock || 0) > 0).length;
  const dead = products.filter((p) => (p.periodSales || 0) === 0 && (p.stock || 0) > 0).length;
  const otherActive = Math.max(total - sold - out - dead, 0); // residual (debería ser 0)

  return (
    <div className="card p-5">
      <div className="flex justify-between items-baseline mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Salud del catálogo</p>
          <p className="text-[12px] text-gray-200 mt-0.5">Proporción del surtido por estado de rotación</p>
        </div>
        <p className="text-[11px] text-gray-300">{fmtNum(total)} productos</p>
      </div>

      <div className="flex w-full h-7 rounded-md overflow-hidden bg-white/[0.04] gap-[2px] mb-3">
        {sold > 0 && (
          <div
            className="flex items-center justify-center text-[10.5px] font-bold text-white min-w-[28px]"
            style={{ flex: sold, background: 'linear-gradient(90deg, #34d399, #10b981)' }}
            title={`Vendidos: ${sold}`}
          >
            {sold}
          </div>
        )}
        {otherActive > 0 && (
          <div
            className="flex items-center justify-center text-[10.5px] font-bold text-white/55 min-w-[28px]"
            style={{ flex: otherActive, background: 'rgba(255,255,255,0.08)' }}
            title={`Activos sin venta: ${otherActive}`}
          >
            {otherActive}
          </div>
        )}
        {dead > 0 && (
          <div
            className="flex items-center justify-center text-[10.5px] font-bold text-white min-w-[28px]"
            style={{ flex: dead, background: 'linear-gradient(90deg, #fbbf24, #f59e0b)' }}
            title={`Sin movimiento: ${dead}`}
          >
            {dead}
          </div>
        )}
        {out > 0 && (
          <div
            className="flex items-center justify-center text-[10.5px] font-bold text-white min-w-[28px]"
            style={{ flex: out, background: 'linear-gradient(90deg, #f87171, #ef4444)' }}
            title={`Sin stock: ${out}`}
          >
            {out}
          </div>
        )}
      </div>

      <div className="flex gap-6 flex-wrap text-[12px] text-gray-100">
        <LegendItem color="#34d399" label="Vendidos" count={sold} pct={fmtPct(sold, total)} />
        <LegendItem color="rgba(255,255,255,0.25)" label="Activos sin venta" count={otherActive} pct={fmtPct(otherActive, total)} />
        <LegendItem color="#fbbf24" label="Sin movimiento" count={dead} pct={fmtPct(dead, total)} />
        <LegendItem color="#f87171" label="Sin stock" count={out} pct={fmtPct(out, total)} />
      </div>
    </div>
  );
}

function LegendItem({ color, label, count, pct }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      {label} · <strong className="text-white">{fmtNum(count)}</strong> · {pct}
    </span>
  );
}
