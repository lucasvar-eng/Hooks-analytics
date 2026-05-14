/**
 * Panel de insights del período: KPIs (Recurrencia, CAC, ratio CAC/LTV)
 * + Top clientes del período + Histograma de días desde última compra.
 *
 * Insumos del giorlent / Daily Tracker que la app no exponía hasta ahora
 * agrupados en un solo lugar.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../services/api';

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
function fmtPct(v, digits = 1) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(digits)}%`;
}
function fmtRatio(v) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(2)}x`;
}

function recurrenceTone(pct) {
  if (pct >= 30) return 'text-emerald-300';
  if (pct >= 15) return 'text-amber-300';
  return 'text-red-300';
}

function cacRatioTone(ratio) {
  if (ratio == null) return 'text-app-muted';
  if (ratio <= 0.3) return 'text-emerald-300';
  if (ratio <= 0.5) return 'text-amber-300';
  return 'text-red-300';
}

export default function PeriodInsightsPanel() {
  const { storeId } = useParams();
  const { from, to } = useSelector((s) => s.date);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId || !from || !to) return;
    let cancelled = false;
    setLoading(true);
    api.get(`/api/stores/${storeId}/customers/period-insights`, { params: { from, to } })
      .then(({ data }) => { if (!cancelled) setData(data); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [storeId, from, to]);

  if (loading) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px] text-app-secondary">Calculando insights del período…</p>
      </div>
    );
  }
  if (!data || !data.period) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px] text-app-secondary">Sin datos del período.</p>
      </div>
    );
  }

  const { period, topPeriodCustomers = [], daysSinceLastPurchase = [] } = data;
  const maxHistCount = Math.max(...daysSinceLastPurchase.map((b) => b.count), 1);

  return (
    <div className="card p-5">
      <div className="mb-5">
        <h3 className="text-white text-[15px] font-semibold">Insights de clientes — período seleccionado</h3>
        <p className="text-app-secondary text-[12px] mt-1">
          Recurrencia, costo de adquisición y top compradores del rango de fechas
        </p>
      </div>

      {/* KPIs cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Recurrencia</p>
          <p className={`text-[20px] font-bold tabular-nums mt-1 ${recurrenceTone(period.recurrencePct)}`}>
            {fmtPct(period.recurrencePct)}
          </p>
          <p className="text-app-muted text-[11px] mt-1">
            {period.recurrentCustomers} de {period.uniqueCustomers} compradores
          </p>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">CAC del período</p>
          <p className="text-[20px] font-bold tabular-nums mt-1 text-white">
            {period.cac != null ? fmtMoney(period.cac) : '—'}
          </p>
          <p className="text-app-muted text-[11px] mt-1">
            {fmtMoneyShort(period.adSpend)} spend / {period.newCustomers} nuevos
          </p>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">LTV promedio</p>
          <p className="text-[20px] font-bold tabular-nums mt-1 text-white">
            {period.avgLtv > 0 ? fmtMoney(period.avgLtv) : '—'}
          </p>
          <p className="text-app-muted text-[11px] mt-1">Lifetime, todos los clientes</p>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">CAC / LTV</p>
          <p className={`text-[20px] font-bold tabular-nums mt-1 ${cacRatioTone(period.cacLtvRatio)}`}>
            {period.cacLtvRatio != null ? fmtRatio(period.cacLtvRatio) : '—'}
          </p>
          <p className="text-app-muted text-[11px] mt-1">
            {period.cacLtvRatio == null
              ? 'Sin datos suficientes'
              : period.cacLtvRatio <= 0.3
                ? '✓ Sano · podés escalar'
                : period.cacLtvRatio <= 0.5
                  ? '⚠ Aceptable · vigilar'
                  : '✗ Caro · revisá funnel'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-5">
        {/* Top clientes período */}
        <div>
          <p className="text-app-muted text-[10px] uppercase tracking-[0.16em] mb-3 font-semibold">
            Top compradores del período
          </p>
          {topPeriodCustomers.length === 0 ? (
            <p className="text-[12px] text-app-secondary">Sin compradores en el período.</p>
          ) : (
            <div className="space-y-1">
              {topPeriodCustomers.map((c, i) => (
                <div key={c._id} className="flex items-center gap-3 py-2 px-2 rounded hover:bg-white/[0.02] transition">
                  <span className="text-app-muted text-[11px] font-mono w-5">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-[12.5px] font-medium truncate" title={c._id}>
                      {c.customerName || c._id}
                    </p>
                    <p className="text-app-muted text-[10.5px] truncate">{c._id}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-emerald-300 text-[12.5px] font-semibold tabular-nums">{fmtMoney(c.totalSpent)}</p>
                    <p className="text-app-muted text-[10.5px]">{c.ordenes} {c.ordenes === 1 ? 'orden' : 'órdenes'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Histograma días desde última compra */}
        <div>
          <p className="text-app-muted text-[10px] uppercase tracking-[0.16em] mb-3 font-semibold">
            Días desde última compra
          </p>
          {daysSinceLastPurchase.length === 0 ? (
            <p className="text-[12px] text-app-secondary">Sin clientes con compras registradas.</p>
          ) : (
            <div className="space-y-1.5">
              {daysSinceLastPurchase.map((b) => {
                const pct = (b.count / maxHistCount) * 100;
                const isRisk = b.lowerDay >= 60;
                return (
                  <div key={b.bucket} className="grid items-center gap-2" style={{ gridTemplateColumns: '90px 1fr 50px' }}>
                    <span className={`text-[11.5px] ${isRisk ? 'text-amber-300' : 'text-app-secondary'}`}>{b.bucket}</span>
                    <div className="h-5 bg-white/[0.03] rounded overflow-hidden">
                      <div
                        className={`h-full ${isRisk ? 'bg-amber-400/60' : 'bg-blue-400/60'} transition-all duration-500`}
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                    </div>
                    <span className="text-right text-white text-[12px] font-bold tabular-nums">{b.count}</span>
                  </div>
                );
              })}
              <p className="text-[10px] text-app-muted mt-2">
                Los buckets &gt;60d son candidatos a campañas de retención.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
