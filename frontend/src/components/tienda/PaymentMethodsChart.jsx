/**
 * Donut chart de medios de pago + lista lateral con % y comisiones.
 * Reemplaza la tabla completa anterior — para detalle full hay link "Ver detalle".
 */

const COLORS = ['#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#f43f5e', '#8b5cf6'];

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

export default function PaymentMethodsChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px] text-app-secondary">Sin datos de medios de pago.</p>
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0));
  const total = sorted.reduce((s, d) => s + Number(d.revenue || 0), 0);
  const totalOrders = sorted.reduce((s, d) => s + Number(d.ordenes || 0), 0);
  const totalCommission = sorted.reduce((s, d) => s + Number(d.comisionPago || 0) + Number(d.comisionCuotas || 0), 0);

  // Donut SVG values
  const size = 180;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-white text-[15px] font-semibold">Medios de pago</h3>
          <p className="text-app-secondary text-[12px] mt-1">Por dónde te están pagando · facturación y comisión total</p>
        </div>
        <div className="text-right">
          <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Comisión total</p>
          <p className="text-red-300 text-[16px] font-bold tabular-nums">−{fmtMoneyShort(totalCommission)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[200px,1fr] gap-6 items-center">
        <div className="flex items-center justify-center">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={stroke}
            />
            {sorted.map((d, i) => {
              const value = Number(d.revenue || 0);
              const pct = total > 0 ? value / total : 0;
              const dash = pct * circumference;
              const segment = (
                <circle
                  key={d._id || i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={stroke}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              );
              offset += dash;
              return segment;
            })}
            <text x={size / 2} y={size / 2 - 6} textAnchor="middle" fill="#71717a" fontSize="10" style={{ textTransform: 'uppercase', letterSpacing: '0.16em' }}>Órdenes</text>
            <text x={size / 2} y={size / 2 + 16} textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700">{totalOrders.toLocaleString('es-AR')}</text>
          </svg>
        </div>

        <div className="space-y-2">
          {sorted.map((d, i) => {
            const value = Number(d.revenue || 0);
            const pct = total > 0 ? (value / total) * 100 : 0;
            const commission = Number(d.comisionPago || 0) + Number(d.comisionCuotas || 0);
            const commissionPct = value > 0 ? (commission / value) * 100 : 0;
            return (
              <div key={d._id || i} className="flex items-center gap-3 py-1.5">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[13px] font-medium truncate">{d._id || 'Sin gateway'}</p>
                  <p className="text-app-muted text-[11px]">{d.ordenes} órdenes · {d.avgCuotas?.toFixed(1) || '—'} cuotas prom · comisión {commissionPct.toFixed(1)}%</p>
                </div>
                <div className="text-right">
                  <p className="text-white text-[13px] font-semibold tabular-nums">{fmtMoney(value)}</p>
                  <p className="text-app-muted text-[11px]">{pct.toFixed(1)}%</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
