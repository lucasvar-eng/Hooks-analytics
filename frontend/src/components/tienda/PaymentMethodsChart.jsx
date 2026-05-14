/**
 * Donut chart con tabs:
 *  - Por medio (gateway) — facturación + comisión total
 *  - Por estado (paymentStatus) — incluye Anuladas/Pendientes/Reembolsadas
 */

import { useMemo, useState } from 'react';

const COLORS = ['#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#f43f5e', '#8b5cf6'];

const STATUS_LABELS = {
  paid: 'Pagado',
  pending: 'Pendiente',
  voided: 'Anulado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  partially_paid: 'Pago parcial',
  partially_refunded: 'Reembolso parcial',
  sin_estado: 'Sin estado',
};

const STATUS_COLORS = {
  paid: '#10b981',
  pending: '#f59e0b',
  voided: '#71717a',
  cancelled: '#71717a',
  refunded: '#ef4444',
  partially_paid: '#a855f7',
  partially_refunded: '#f43f5e',
  sin_estado: '#52525b',
};

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

export default function PaymentMethodsChart({ data = [], byPaymentStatus = [] }) {
  const [tab, setTab] = useState('gateway');

  const view = useMemo(() => {
    if (tab === 'status') {
      const sorted = [...byPaymentStatus].sort((a, b) => Number(b.ordenes || 0) - Number(a.ordenes || 0));
      const total = sorted.reduce((s, d) => s + Number(d.revenue || 0), 0);
      const totalOrders = sorted.reduce((s, d) => s + Number(d.ordenes || 0), 0);
      const voided = sorted.find((d) => d._id === 'voided' || d._id === 'cancelled');
      const cancelRatePct = totalOrders > 0 ? ((voided?.ordenes || 0) / totalOrders) * 100 : 0;
      return { sorted, total, totalOrders, mode: 'status', cancelRatePct };
    }
    const sorted = [...data].sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0));
    const total = sorted.reduce((s, d) => s + Number(d.revenue || 0), 0);
    const totalOrders = sorted.reduce((s, d) => s + Number(d.ordenes || 0), 0);
    const totalCommission = sorted.reduce(
      (s, d) => s + Number(d.comisionPago || 0) + Number(d.comisionCuotas || 0),
      0
    );
    return { sorted, total, totalOrders, totalCommission, mode: 'gateway' };
  }, [tab, data, byPaymentStatus]);

  const sourceLen = tab === 'status' ? byPaymentStatus.length : data.length;
  if (sourceLen === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px] text-app-secondary">Sin datos en este período.</p>
      </div>
    );
  }

  const size = 180;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const colorFor = (row, i) =>
    tab === 'status'
      ? STATUS_COLORS[row._id] || COLORS[i % COLORS.length]
      : COLORS[i % COLORS.length];

  const labelFor = (row) =>
    tab === 'status' ? STATUS_LABELS[row._id] || row._id || 'Sin estado' : row._id || 'Sin gateway';

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div>
          <h3 className="text-white text-[15px] font-semibold">
            {tab === 'status' ? 'Pagos por estado' : 'Medios de pago'}
          </h3>
          <p className="text-app-secondary text-[12px] mt-1">
            {tab === 'status'
              ? 'Distribución de órdenes por estado — incluye anuladas y pendientes'
              : 'Por dónde te están pagando · facturación y comisión total'}
          </p>
        </div>
        <div className="text-right">
          {view.mode === 'gateway' ? (
            <>
              <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Comisión total</p>
              <p className="text-red-300 text-[16px] font-bold tabular-nums">−{fmtMoneyShort(view.totalCommission)}</p>
            </>
          ) : (
            <>
              <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Tasa cancelación</p>
              <p className={`text-[16px] font-bold tabular-nums ${
                view.cancelRatePct >= 5 ? 'text-red-300' : view.cancelRatePct >= 2 ? 'text-amber-300' : 'text-emerald-300'
              }`}>
                {view.cancelRatePct.toFixed(1)}%
              </p>
            </>
          )}
        </div>
      </div>

      <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] p-0.5 text-[11px] mb-4">
        <button
          type="button"
          onClick={() => setTab('gateway')}
          className={`px-3 py-1 rounded-full transition ${tab === 'gateway' ? 'bg-blue-500/20 text-blue-200' : 'text-gray-300 hover:text-white'}`}
        >
          Por medio
        </button>
        <button
          type="button"
          onClick={() => setTab('status')}
          className={`px-3 py-1 rounded-full transition ${tab === 'status' ? 'bg-blue-500/20 text-blue-200' : 'text-gray-300 hover:text-white'}`}
        >
          Por estado
        </button>
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
            {view.sorted.map((d, i) => {
              const refValue = tab === 'status' ? Number(d.ordenes || 0) : Number(d.revenue || 0);
              const refTotal = tab === 'status' ? view.totalOrders : view.total;
              const pct = refTotal > 0 ? refValue / refTotal : 0;
              const dash = pct * circumference;
              const segment = (
                <circle
                  key={d._id || i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={colorFor(d, i)}
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
            <text x={size / 2} y={size / 2 + 16} textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700">{view.totalOrders.toLocaleString('es-AR')}</text>
          </svg>
        </div>

        <div className="space-y-2">
          {view.sorted.map((d, i) => {
            const value = Number(d.revenue || 0);
            const ordenes = Number(d.ordenes || 0);
            if (view.mode === 'status') {
              const pct = view.totalOrders > 0 ? (ordenes / view.totalOrders) * 100 : 0;
              return (
                <div key={d._id || i} className="flex items-center gap-3 py-1.5">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: colorFor(d, i) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[13px] font-medium truncate">{labelFor(d)}</p>
                    <p className="text-app-muted text-[11px]">{ordenes} órdenes · {fmtMoneyShort(value)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-[13px] font-semibold tabular-nums">{pct.toFixed(1)}%</p>
                  </div>
                </div>
              );
            }
            const pct = view.total > 0 ? (value / view.total) * 100 : 0;
            const commission = Number(d.comisionPago || 0) + Number(d.comisionCuotas || 0);
            const commissionPct = value > 0 ? (commission / value) * 100 : 0;
            return (
              <div key={d._id || i} className="flex items-center gap-3 py-1.5">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: colorFor(d, i) }} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[13px] font-medium truncate">{labelFor(d)}</p>
                  <p className="text-app-muted text-[11px]">{ordenes} órdenes · {d.avgCuotas?.toFixed(1) || '—'} cuotas prom · comisión {commissionPct.toFixed(1)}%</p>
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
