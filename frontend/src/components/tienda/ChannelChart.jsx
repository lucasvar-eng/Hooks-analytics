/**
 * Barras horizontales por canal de venta (tiendanube, marketplace, POS, etc.)
 * Visualización compacta — un solo bloque, sin donut.
 */

const COLORS = ['#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '$0';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}

function labelCanal(c) {
  if (!c) return 'Sin canal';
  const map = {
    tiendanube: 'Tiendanube online',
    pos: 'Punto de venta',
    marketplace: 'Marketplaces',
    instagram: 'Instagram',
    facebook: 'Facebook',
  };
  return map[String(c).toLowerCase()] || c;
}

export default function ChannelChart({ data = [] }) {
  if (!data || data.length === 0) {
    return null;
  }

  const sorted = [...data].sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0));
  const total = sorted.reduce((s, d) => s + Number(d.revenue || 0), 0);
  if (total === 0) return null;

  return (
    <div className="card p-5">
      <h3 className="text-white text-[15px] font-semibold mb-1">Canal de venta</h3>
      <p className="text-app-secondary text-[12px] mb-4">De dónde vienen las órdenes — para ver el peso de cada canal</p>

      <div className="space-y-3">
        {sorted.map((d, i) => {
          const value = Number(d.revenue || 0);
          const pct = total > 0 ? (value / total) * 100 : 0;
          const color = COLORS[i % COLORS.length];
          return (
            <div key={d._id || i}>
              <div className="flex items-center justify-between mb-1.5 text-[12px]">
                <span className="text-white font-medium">{labelCanal(d._id)}</span>
                <span className="text-app-secondary tabular-nums">
                  {fmtMoney(value)} · {d.ordenes} órdenes · <span className="text-app-muted">{pct.toFixed(1)}%</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
