/**
 * Dual chart: barras de Facturación por día (background) + línea de
 * Ventas (count) por día (overlay). Pensado para responder "cómo me
 * fue cada día" con la métrica plata como protagonista.
 *
 * SVG inline — sin dependencias externas.
 */

function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '$0';
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

function shortDate(s) {
  if (!s) return '';
  // s viene como YYYY-MM-DD
  const [, m, d] = s.split('-');
  return `${d}/${m}`;
}

export default function DailySalesRevenueChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px] text-app-secondary">Sin actividad diaria en el período.</p>
      </div>
    );
  }

  const series = [...data].sort((a, b) => String(a._id).localeCompare(String(b._id)));
  const revenues = series.map((d) => Number(d.revenue || 0));
  const orders = series.map((d) => Number(d.ordenes || 0));

  const totalRevenue = revenues.reduce((s, v) => s + v, 0);
  const totalOrders = orders.reduce((s, v) => s + v, 0);
  const maxRevenue = Math.max(...revenues, 1);
  const maxOrders = Math.max(...orders, 1);

  const width = 1000;
  const height = 240;
  const padTop = 24;
  const padBottom = 32;
  const padX = 24;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;

  const barWidth = Math.max(8, (innerW / series.length) * 0.6);
  const step = innerW / series.length;

  const linePoints = series.map((d, i) => {
    const x = padX + step * i + step / 2;
    const y = padTop + innerH - (Number(d.ordenes || 0) / maxOrders) * innerH;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-white text-[15px] font-semibold">Ventas y facturación por día</h3>
          <p className="text-app-secondary text-[12px] mt-1">Barras = facturación · línea = cantidad de órdenes</p>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Facturación</p>
            <p className="text-white text-[16px] font-bold tabular-nums">{fmtMoneyShort(totalRevenue)}</p>
          </div>
          <div className="text-right">
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Órdenes</p>
            <p className="text-white text-[16px] font-bold tabular-nums">{totalOrders.toLocaleString('es-AR')}</p>
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
        style={{ overflow: 'visible' }}
      >
        {/* Bars: revenue */}
        {series.map((d, i) => {
          const value = Number(d.revenue || 0);
          const h = (value / maxRevenue) * innerH;
          const x = padX + step * i + (step - barWidth) / 2;
          const y = padTop + innerH - h;
          return (
            <g key={d._id || i}>
              <rect x={x} y={y} width={barWidth} height={h} fill="#3b82f6" opacity="0.5" rx="2" />
              <title>{`${d._id} · ${fmtMoneyShort(value)} · ${d.ordenes || 0} órdenes`}</title>
            </g>
          );
        })}

        {/* Line: orders */}
        <polyline
          fill="none"
          stroke="#10b981"
          strokeWidth="2"
          points={linePoints}
        />

        {/* Dots on line */}
        {series.map((d, i) => {
          const x = padX + step * i + step / 2;
          const y = padTop + innerH - (Number(d.ordenes || 0) / maxOrders) * innerH;
          return <circle key={`dot-${i}`} cx={x} cy={y} r="3" fill="#10b981" />;
        })}

        {/* X axis labels */}
        {series.map((d, i) => {
          const x = padX + step * i + step / 2;
          // mostrar solo cada N labels si hay muchos
          const skip = series.length > 14 ? 2 : 1;
          if (i % skip !== 0) return null;
          return (
            <text
              key={`lbl-${i}`}
              x={x}
              y={height - 8}
              fill="#71717a"
              fontSize="10"
              textAnchor="middle"
            >
              {shortDate(d._id)}
            </text>
          );
        })}
      </svg>

      <div className="flex items-center gap-4 mt-2 text-[11px] text-app-secondary">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-500/50" />
          Facturación
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-emerald-500" />
          Órdenes
        </span>
      </div>
    </div>
  );
}
