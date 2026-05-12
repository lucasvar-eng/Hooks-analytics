/**
 * Forecast unificado de cashflow:
 *  - Barras: ingresos TN + ingresos manuales − egresos manuales por día
 *  - Línea: saldo acumulado proyectado (parte del balanceStart)
 *  - Detector de cash gap: el primer día que el saldo proyectado se va a negativo
 */

import { useMemo, useState } from 'react';

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '$0';
  const n = Number(v);
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('es-AR')}`;
}
function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '$0';
  const n = Number(v);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
function shortDate(s) {
  if (!s) return '';
  const [, m, d] = s.split('-');
  return `${d}/${m}`;
}
function dayOfWeek(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  return DOW[new Date(y, m - 1, d).getDay()];
}

export default function UnifiedProjectionChart({ data, onChangeDays }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  const series = data?.projection || [];
  const totals = data?.totals || {};
  const firstGap = data?.firstGap;

  if (series.length === 0) {
    return (
      <div className="card p-8 text-center text-app-secondary text-[13px]">
        Sin datos para proyectar todavía. Cargá saldos bancarios y movimientos para activar el forecast.
      </div>
    );
  }

  // Escalas
  const allValues = series.map((d) => Math.abs(d.movimientoNeto)).concat(series.map((d) => Math.abs(d.saldoAcumulado)));
  const maxAbs = Math.max(...allValues, 1);
  const niceMax = roundUp(maxAbs);

  const width = 1200;
  const height = 380;
  const padTop = 24;
  const padBottom = 60;
  const padLeft = 70;
  const padRight = 70;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const zeroY = padTop + innerH / 2;

  const step = innerW / series.length;
  const barWidth = Math.max(4, step * 0.55);

  const yForValue = (v) => zeroY - (v / niceMax) * (innerH / 2);

  const linePoints = series.map((d, i) => [padLeft + step * i + step / 2, yForValue(d.saldoAcumulado)]);

  const hoverItem = hoverIdx != null ? series[hoverIdx] : null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h3 className="text-white text-[15px] font-semibold">Proyección unificada de cashflow</h3>
          <p className="text-app-secondary text-[12px] mt-1">
            Ingresos TN + manuales − egresos manuales por día. La línea ámbar es el saldo acumulado partiendo de tus cuentas líquidas.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-md p-0.5">
            {[14, 30, 60, 90, 180].map((d) => (
              <button
                key={d}
                onClick={() => onChangeDays(d)}
                className={`px-2.5 py-1.5 rounded text-[11px] font-medium transition ${
                  data?.horizon?.days === d ? 'bg-blue-500/20 text-blue-200' : 'text-app-secondary hover:text-white'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs hero */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Tile label="Saldo inicial" value={fmtMoney(data?.balanceStart)} sub={`${data?.accounts?.liquid || 0} cuentas líquidas`} />
        <Tile label="Ingresos TN" value={fmtMoneyShort(totals.ingresoTN)} accent="emerald" />
        <Tile label="Ingresos manuales" value={fmtMoneyShort(totals.ingresoManual)} accent="emerald" />
        <Tile label="Egresos manuales" value={fmtMoneyShort(totals.egresoManual)} accent="red" />
        <Tile label="Saldo final proyectado" value={fmtMoneyShort(totals.saldoFinal)} accent={Number(totals.saldoFinal) >= 0 ? 'emerald' : 'red'} bold />
      </div>

      {/* Cash gap warning */}
      {firstGap && (
        <div className="mb-5 p-4 rounded-lg border border-red-500/30 bg-red-500/[0.08]">
          <div className="flex items-start gap-3">
            <span className="text-[20px]">⚠</span>
            <div>
              <p className="text-red-300 text-[13px] font-bold uppercase tracking-[0.12em]">Alerta de cash gap</p>
              <p className="text-white text-[14px] mt-1">
                Tu saldo proyectado entra en rojo el <span className="font-bold tabular-nums">{shortDate(firstGap.date)}</span>{' '}
                <span className="text-app-muted">({firstGap.daysFromToday} {firstGap.daysFromToday === 1 ? 'día' : 'días'} desde hoy)</span> con
                un déficit de <span className="text-red-300 font-bold tabular-nums">{fmtMoney(firstGap.saldo)}</span>.
                Considerá adelantar cobros o postergar egresos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          style={{ display: 'block', overflow: 'visible' }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="netoPositive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="netoNegative" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#991b1b" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="saldoArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </linearGradient>
            <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Eje cero */}
          <line x1={padLeft} y1={zeroY} x2={width - padRight} y2={zeroY} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
          <text x={width - padRight + 8} y={zeroY + 4} fill="#71717a" fontSize="11" className="tabular-nums">$0</text>

          {/* Grid + escala Y arriba (ingresos) y abajo (egresos) */}
          {[0.5, 1].map((frac) => (
            <g key={`gridp-${frac}`}>
              <line x1={padLeft} y1={zeroY - innerH / 2 * frac} x2={width - padRight} y2={zeroY - innerH / 2 * frac} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 5" />
              <text x={width - padRight + 8} y={zeroY - innerH / 2 * frac + 4} fill="#71717a" fontSize="11" className="tabular-nums">{fmtMoneyShort(niceMax * frac)}</text>
              <line x1={padLeft} y1={zeroY + innerH / 2 * frac} x2={width - padRight} y2={zeroY + innerH / 2 * frac} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 5" />
              <text x={width - padRight + 8} y={zeroY + innerH / 2 * frac + 4} fill="#71717a" fontSize="11" className="tabular-nums">{fmtMoneyShort(-niceMax * frac)}</text>
            </g>
          ))}

          {/* Marcador "hoy" */}
          {(() => {
            const todayIdx = series.findIndex((d) => d.date === today);
            if (todayIdx < 0) return null;
            const x = padLeft + step * todayIdx + step / 2;
            return (
              <g>
                <line x1={x} y1={padTop} x2={x} y2={padTop + innerH} stroke="#fbbf24" strokeWidth="1" strokeDasharray="2 4" opacity="0.5" />
                <text x={x} y={padTop - 6} fill="#fbbf24" fontSize="10" textAnchor="middle" fontWeight="600">HOY</text>
              </g>
            );
          })()}

          {/* Marcador cash gap */}
          {firstGap && (() => {
            const gapIdx = series.findIndex((d) => d.date === firstGap.date);
            if (gapIdx < 0) return null;
            const x = padLeft + step * gapIdx + step / 2;
            return (
              <g>
                <line x1={x} y1={padTop} x2={x} y2={padTop + innerH} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.7" />
                <rect x={x - 32} y={padTop - 18} width={64} height={14} rx="2" fill="#ef4444" />
                <text x={x} y={padTop - 7} fill="#fff" fontSize="9" textAnchor="middle" fontWeight="700">CASH GAP</text>
              </g>
            );
          })()}

          {/* Barras de movimiento neto */}
          {series.map((d, i) => {
            const x = padLeft + step * i + (step - barWidth) / 2;
            const value = d.movimientoNeto;
            const y = value >= 0 ? yForValue(value) : zeroY;
            const h = Math.abs(yForValue(value) - zeroY);
            const hovered = hoverIdx === i;
            return (
              <g key={d.date} onMouseEnter={() => setHoverIdx(i)}>
                <rect x={padLeft + step * i} y={padTop} width={step} height={innerH} fill="transparent" />
                {value !== 0 && (
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(h, 1)}
                    fill={value >= 0 ? 'url(#netoPositive)' : 'url(#netoNegative)'}
                    rx="2"
                    opacity={hovered ? 1 : 0.85}
                  />
                )}
              </g>
            );
          })}

          {/* Línea de saldo acumulado */}
          <polyline
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#lineGlow)"
            points={linePoints.map(([x, y]) => `${x},${y}`).join(' ')}
          />

          {/* Eje X labels */}
          {series.map((d, i) => {
            const skip = series.length > 60 ? 7 : series.length > 30 ? 4 : 2;
            if (i % skip !== 0 && hoverIdx !== i) return null;
            const x = padLeft + step * i + step / 2;
            return (
              <g key={`lbl-${i}`}>
                <text x={x} y={padTop + innerH + 22} fill="#a1a1aa" fontSize="10.5" textAnchor="middle" className="tabular-nums">
                  {shortDate(d.date)}
                </text>
                <text x={x} y={padTop + innerH + 36} fill="#71717a" fontSize="9" textAnchor="middle">
                  {dayOfWeek(d.date)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hoverItem && (
          <div
            className="absolute pointer-events-none rounded-lg shadow-2xl"
            style={{
              left: `${((padLeft + step * hoverIdx + step / 2) / width) * 100}%`,
              top: '8px',
              transform: 'translateX(-50%)',
              minWidth: 220,
              background: '#0f0f12',
              border: '1px solid rgba(255,255,255,0.08)',
              borderTop: `2px solid ${hoverItem.inGap ? '#ef4444' : '#fbbf24'}`,
              padding: '12px 14px',
            }}
          >
            <p className="text-app-secondary text-[12px] font-semibold">{dayOfWeek(hoverItem.date)} {shortDate(hoverItem.date)}</p>
            <p className={`text-[20px] font-bold tabular-nums leading-none mt-2 ${hoverItem.inGap ? 'text-red-300' : 'text-white'}`}>
              {fmtMoney(hoverItem.saldoAcumulado)}
            </p>
            <p className="text-app-muted text-[10px] mt-0.5">saldo acumulado</p>
            <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1 text-[11.5px]">
              {hoverItem.ingresoTN > 0 && <Row lbl="+ Ingresos TN" val={fmtMoney(hoverItem.ingresoTN)} color="text-emerald-300" />}
              {hoverItem.ingresoManual > 0 && <Row lbl="+ Ingresos manuales" val={fmtMoney(hoverItem.ingresoManual)} color="text-emerald-300" />}
              {hoverItem.egresoManual > 0 && <Row lbl="− Egresos" val={fmtMoney(hoverItem.egresoManual)} color="text-red-300" />}
              <Row lbl="Movimiento neto" val={fmtMoney(hoverItem.movimientoNeto)} color={hoverItem.movimientoNeto >= 0 ? 'text-white font-semibold' : 'text-red-300 font-semibold'} />
            </div>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-5 mt-4 text-[11px] text-app-secondary flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(180deg, #34d399, #059669)' }} />
          Ingresos del día
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(180deg, #ef4444, #991b1b)' }} />
          Egresos del día
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-[2.5px] rounded-full bg-amber-400" />
          Saldo acumulado proyectado
        </span>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, accent, bold }) {
  const accentClass = accent === 'emerald' ? 'text-emerald-300' : accent === 'red' ? 'text-red-300' : 'text-white';
  return (
    <div className="rounded-lg bg-white/[0.025] border border-white/[0.05] p-3">
      <p className="text-app-muted text-[10px] uppercase tracking-[0.16em] font-semibold">{label}</p>
      <p className={`text-[18px] tabular-nums leading-none mt-2 ${accentClass} ${bold ? 'font-bold' : 'font-semibold'}`}>{value}</p>
      {sub && <p className="text-app-muted text-[10.5px] mt-1.5">{sub}</p>}
    </div>
  );
}

function Row({ lbl, val, color }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-app-muted">{lbl}</span>
      <span className={`tabular-nums ${color}`}>{val}</span>
    </div>
  );
}

function roundUp(value) {
  if (!value || value <= 0) return 100;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const m = value / base;
  let nice;
  if (m <= 1) nice = 1;
  else if (m <= 2) nice = 2;
  else if (m <= 5) nice = 5;
  else nice = 10;
  return nice * base;
}
