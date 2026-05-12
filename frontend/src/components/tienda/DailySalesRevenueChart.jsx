import { useMemo, useState, useEffect } from 'react';

/**
 * Gráfico dual: barras de Facturación + línea de Órdenes por día.
 * Foco en el área del chart: tipografía existente (Inter), más alto,
 * mejor jerarquía visual, animación de entrada, tooltip prolijo.
 */

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

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function parseDate(s) {
  if (!s) return null;
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
}
function shortDate(s) {
  const d = parseDate(s);
  if (!d) return s;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
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
function niceMax(value) {
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

export default function DailySalesRevenueChart({ data = [] }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  const series = useMemo(
    () => [...(data || [])].sort((a, b) => String(a._id).localeCompare(String(b._id))),
    [data]
  );

  if (!series || series.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px] text-app-secondary">Sin actividad diaria en el período.</p>
      </div>
    );
  }

  const revenues = series.map((d) => Number(d.revenue || 0));
  const orders = series.map((d) => Number(d.ordenes || 0));

  const totalRevenue = revenues.reduce((s, v) => s + v, 0);
  const totalOrders = orders.reduce((s, v) => s + v, 0);
  const avgRevenue = totalRevenue / series.length;
  const avgOrders = totalOrders / series.length;
  const bestDay = series.reduce((best, d) => (Number(d.revenue || 0) > Number(best.revenue || 0) ? d : best), series[0]);
  const bestDayIdx = series.findIndex((d) => d._id === bestDay._id);

  const maxRevenue = niceMax(Math.max(...revenues, 1));
  const maxOrders = Math.max(...orders, 1);

  // Geometría — chart bien grande
  const width = 1200;
  const height = 460;
  const padTop = 32;
  const padBottom = 64;
  const padLeft = 28;
  const padRight = 80;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const barWidth = Math.max(16, (innerW / series.length) * 0.66);
  const step = innerW / series.length;

  const yTicks = 5;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxRevenue / yTicks) * i);

  const linePoints = series.map((d, i) => {
    const x = padLeft + step * i + step / 2;
    const y = padTop + innerH - (Number(d.ordenes || 0) / maxOrders) * innerH;
    return [x, y];
  });

  // Path "área" debajo de la línea (gradient soft)
  const areaPath = linePoints.length > 0
    ? `M ${linePoints[0][0]} ${padTop + innerH} L ${linePoints.map(([x, y]) => `${x} ${y}`).join(' L ')} L ${linePoints[linePoints.length - 1][0]} ${padTop + innerH} Z`
    : '';

  const avgY = padTop + innerH - (avgRevenue / maxRevenue) * innerH;

  const hoverItem = hoverIdx != null ? series[hoverIdx] : null;
  const hoverAov = hoverItem && Number(hoverItem.ordenes || 0) > 0
    ? Number(hoverItem.revenue || 0) / Number(hoverItem.ordenes)
    : null;

  return (
    <div className="card p-5">
      {/* Header simple — los 4 KPIs como estaban */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h3 className="text-white text-[15px] font-semibold">Ventas y facturación por día</h3>
          <p className="text-app-secondary text-[12px] mt-1">Pasá el mouse sobre cualquier día para ver el detalle</p>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="text-right">
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Facturación total</p>
            <p className="text-white text-[18px] font-bold tabular-nums leading-none mt-1">{fmtMoneyShort(totalRevenue)}</p>
          </div>
          <div className="text-right">
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Órdenes</p>
            <p className="text-white text-[18px] font-bold tabular-nums leading-none mt-1">{totalOrders.toLocaleString('es-AR')}</p>
          </div>
          <div className="text-right">
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Promedio diario</p>
            <p className="text-white text-[18px] font-bold tabular-nums leading-none mt-1">{fmtMoneyShort(avgRevenue)}</p>
          </div>
          <div className="text-right">
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Mejor día</p>
            <p className="text-emerald-300 text-[18px] font-bold tabular-nums leading-none mt-1">{shortDate(bestDay._id)}</p>
            <p className="text-app-muted text-[10px] mt-0.5">{fmtMoneyShort(bestDay.revenue)}</p>
          </div>
        </div>
      </div>

      {/* Chart area — el foco del rediseño */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          style={{ display: 'block', overflow: 'visible' }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            {/* Gradient para barras */}
            <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.35" />
            </linearGradient>
            <linearGradient id="barFillHover" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#93c5fd" stopOpacity="1" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id="barFillBest" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="1" />
              <stop offset="100%" stopColor="#047857" stopOpacity="0.5" />
            </linearGradient>
            {/* Gradient área debajo de la línea */}
            <linearGradient id="lineArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </linearGradient>
            {/* Glow para la línea */}
            <filter id="lineGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Drop shadow sutil para barras */}
            <filter id="barShadow" x="-20%" y="-10%" width="140%" height="130%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <feOffset dy="4" />
              <feComponentTransfer><feFuncA type="linear" slope="0.35" /></feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid horizontal */}
          {tickValues.map((tv, i) => {
            const y = padTop + innerH - (tv / maxRevenue) * innerH;
            const isBaseline = i === 0;
            return (
              <g key={`grid-${i}`}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke={isBaseline ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'}
                  strokeWidth="1"
                  strokeDasharray={isBaseline ? '' : '3 5'}
                />
                <text
                  x={width - padRight + 12}
                  y={y + 4}
                  fill="#71717a"
                  fontSize="11"
                  textAnchor="start"
                  className="tabular-nums"
                >
                  {fmtMoneyShort(tv)}
                </text>
              </g>
            );
          })}

          {/* Línea de promedio */}
          {avgRevenue > 0 && (
            <g>
              <line
                x1={padLeft}
                y1={avgY}
                x2={width - padRight}
                y2={avgY}
                stroke="#f59e0b"
                strokeWidth="1"
                strokeDasharray="2 4"
                opacity={mounted ? 0.5 : 0}
                style={{ transition: 'opacity 700ms ease 600ms' }}
              />
              <g opacity={mounted ? 1 : 0} style={{ transition: 'opacity 500ms ease 800ms' }}>
                <rect x={padLeft + 6} y={avgY - 16} width={108} height={18} rx="3" fill="#0f0f12" stroke="#f59e0b" strokeOpacity="0.35" />
                <text x={padLeft + 12} y={avgY - 3} fill="#fbbf24" fontSize="10.5" fontWeight="600" className="tabular-nums">
                  Prom · {fmtMoneyShort(avgRevenue)}
                </text>
              </g>
            </g>
          )}

          {/* Área debajo de la línea de órdenes */}
          {mounted && (
            <path
              d={areaPath}
              fill="url(#lineArea)"
              style={{ opacity: mounted ? 1 : 0, transition: 'opacity 800ms ease 500ms' }}
            />
          )}

          {/* Barras facturación */}
          {series.map((d, i) => {
            const value = Number(d.revenue || 0);
            const h = (value / maxRevenue) * innerH;
            const x = padLeft + step * i + (step - barWidth) / 2;
            const y = padTop + innerH - h;
            const hovered = hoverIdx === i;
            const todayMark = isToday(d._id);
            const isBest = i === bestDayIdx && value > 0;
            const fillId = isBest ? 'url(#barFillBest)' : hovered ? 'url(#barFillHover)' : 'url(#barFill)';
            const animDelay = i * 35;

            return (
              <g key={d._id || i} onMouseEnter={() => setHoverIdx(i)}>
                {/* Hit area completa (transparente) */}
                <rect
                  x={padLeft + step * i}
                  y={padTop}
                  width={step}
                  height={innerH + 20}
                  fill="transparent"
                />
                {/* La barra */}
                <rect
                  x={x}
                  y={mounted ? y : padTop + innerH}
                  width={barWidth}
                  height={mounted ? Math.max(h, 2) : 0}
                  fill={fillId}
                  rx="3"
                  filter="url(#barShadow)"
                  style={{
                    transition: `y 700ms cubic-bezier(0.22,1,0.36,1) ${animDelay}ms, height 700ms cubic-bezier(0.22,1,0.36,1) ${animDelay}ms`,
                  }}
                />
                {/* Highlight stripe arriba de la barra */}
                {h > 6 && mounted && (
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={2.5}
                    fill={isBest ? '#6ee7b7' : hovered ? '#bfdbfe' : '#93c5fd'}
                    rx="1.5"
                    opacity={hovered || isBest ? 1 : 0.7}
                  />
                )}
                {/* Tag mejor día (solo el icono, discreto) */}
                {isBest && mounted && (
                  <g opacity={mounted ? 1 : 0} style={{ transition: 'opacity 500ms ease 1000ms' }}>
                    <circle cx={x + barWidth / 2} cy={y - 14} r="9" fill="#0f0f12" stroke="#34d399" strokeWidth="1" />
                    <text x={x + barWidth / 2} y={y - 10} fill="#34d399" fontSize="11" fontWeight="700" textAnchor="middle">
                      ★
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Línea órdenes */}
          {mounted && (
            <g style={{ opacity: mounted ? 1 : 0, transition: 'opacity 700ms ease 400ms' }}>
              <polyline
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#lineGlow)"
                points={linePoints.map(([x, y]) => `${x},${y}`).join(' ')}
              />
              {linePoints.map(([x, y], i) => {
                const hovered = hoverIdx === i;
                return (
                  <g key={`dot-${i}`}>
                    {hovered && <circle cx={x} cy={y} r={10} fill="#fbbf24" opacity="0.18" />}
                    <circle
                      cx={x}
                      cy={y}
                      r={hovered ? 5.5 : 4}
                      fill="#fbbf24"
                      stroke="#0f0f12"
                      strokeWidth="2"
                      style={{ transition: 'r 200ms ease' }}
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* Línea vertical en el día hovered */}
          {hoverIdx != null && (
            <line
              x1={padLeft + step * hoverIdx + step / 2}
              y1={padTop - 4}
              x2={padLeft + step * hoverIdx + step / 2}
              y2={padTop + innerH}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
          )}

          {/* Marker triangulo "hoy" debajo del eje */}
          {series.map((d, i) => {
            if (!isToday(d._id)) return null;
            const x = padLeft + step * i + step / 2;
            const y = padTop + innerH;
            return (
              <g key={`today-${i}`}>
                <polygon
                  points={`${x - 5},${y + 6} ${x + 5},${y + 6} ${x},${y + 1}`}
                  fill="#fbbf24"
                />
              </g>
            );
          })}

          {/* Eje X labels */}
          {series.map((d, i) => {
            const x = padLeft + step * i + step / 2;
            const skip = series.length > 18 ? 3 : series.length > 10 ? 2 : 1;
            if (i % skip !== 0 && hoverIdx !== i) return null;
            const todayMark = isToday(d._id);
            const isHovered = hoverIdx === i;
            const accent = isHovered ? '#fff' : todayMark ? '#fbbf24' : '#a1a1aa';
            return (
              <g key={`lbl-${i}`}>
                <text
                  x={x}
                  y={padTop + innerH + 26}
                  fill={accent}
                  fontSize="12"
                  textAnchor="middle"
                  fontWeight={isHovered || todayMark ? 600 : 500}
                  className="tabular-nums"
                >
                  {shortDate(d._id)}
                </text>
                <text
                  x={x}
                  y={padTop + innerH + 42}
                  fill="#71717a"
                  fontSize="10"
                  textAnchor="middle"
                  letterSpacing="0.12em"
                >
                  {dayOfWeek(d._id)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip flotante */}
        {hoverItem && (
          <div
            className="absolute pointer-events-none rounded-lg shadow-2xl"
            style={{
              left: `${((padLeft + step * hoverIdx + step / 2) / width) * 100}%`,
              top: '8px',
              transform: 'translateX(-50%)',
              minWidth: 200,
              background: '#0f0f12',
              border: '1px solid rgba(255,255,255,0.08)',
              borderTop: '2px solid #fbbf24',
              padding: '12px 14px',
            }}
          >
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <p className="text-app-secondary text-[12px] font-semibold">
                {dayOfWeek(hoverItem._id)} {shortDate(hoverItem._id)}
              </p>
              {isToday(hoverItem._id) && (
                <span className="text-[9px] text-amber-400 px-1.5 py-0.5 border border-amber-400/40 rounded uppercase tracking-wider font-bold">
                  Hoy
                </span>
              )}
              {bestDayIdx === hoverIdx && (
                <span className="text-[9px] text-emerald-300 px-1.5 py-0.5 border border-emerald-400/40 rounded uppercase tracking-wider font-bold">
                  Mejor
                </span>
              )}
            </div>
            <p className="text-white text-[22px] font-bold tabular-nums leading-none">
              {fmtMoney(hoverItem.revenue)}
            </p>
            <p className="text-app-muted text-[10px] mt-0.5">facturación del día</p>

            <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
              <span className="text-app-secondary">Órdenes</span>
              <span className="text-amber-300 text-right tabular-nums font-semibold">
                {Number(hoverItem.ordenes || 0).toLocaleString('es-AR')}
              </span>
              {hoverAov != null && (
                <>
                  <span className="text-app-secondary">AOV</span>
                  <span className="text-white text-right tabular-nums">{fmtMoney(hoverAov)}</span>
                </>
              )}
              {Number(hoverItem.ncOrdenes || 0) + Number(hoverItem.rcOrdenes || 0) > 0 && (
                <>
                  <span className="text-app-secondary">NC / RC</span>
                  <span className="text-white text-right tabular-nums">
                    <span className="text-blue-300">{Number(hoverItem.ncOrdenes || 0)}</span>
                    <span className="text-app-muted mx-1">/</span>
                    <span className="text-emerald-300">{Number(hoverItem.rcOrdenes || 0)}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-5 mt-4 text-[11px] text-app-secondary flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 rounded-sm" style={{ background: 'linear-gradient(180deg, #60a5fa, #1d4ed8)' }} />
          Facturación
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-[2.5px] rounded-full bg-amber-400" />
          Órdenes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-[1px] bg-amber-500" style={{ borderTop: '1px dashed' }} />
          Promedio · {avgOrders.toFixed(1)} órdenes/día
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-emerald-400 text-emerald-400 text-[9px] font-bold">★</span>
          Mejor día
        </span>
      </div>
    </div>
  );
}
