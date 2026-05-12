import { useMemo, useState, useEffect } from 'react';

/**
 * Chart diario Meta: barras de Spend + barras de Revenue (lado a lado por día)
 * + línea de ROAS sobre eje secundario.
 *
 * Mismo lenguaje visual que DailySalesRevenueChart de Tienda.
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
function fmtMultiple(v, digits = 2) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(digits)}x`;
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

export default function MetaSpendRevenueChart({ data = [] }) {
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
        <p className="text-[13px] text-app-secondary">Sin actividad publicitaria diaria en el período.</p>
      </div>
    );
  }

  const spends = series.map((d) => Number(d.spend || 0));
  const revenues = series.map((d) => Number(d.purchaseValue || 0));
  const totalSpend = spends.reduce((s, v) => s + v, 0);
  const totalRevenue = revenues.reduce((s, v) => s + v, 0);
  const totalRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  const roasSeries = series.map((d) => {
    const sp = Number(d.spend || 0);
    const rv = Number(d.purchaseValue || 0);
    return sp > 0 ? rv / sp : 0;
  });

  const maxBarValue = niceMax(Math.max(...spends, ...revenues, 1));
  const maxRoas = Math.max(...roasSeries, 1);

  const showValuesAlways = series.length <= 12;

  // Geometría
  const width = 1200;
  const height = 460;
  const padTop = 32;
  const padBottom = 64;
  const padLeft = 28;
  const padRight = 80;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const groupWidth = (innerW / series.length) * 0.7;
  const barWidth = groupWidth / 2 - 2;
  const step = innerW / series.length;

  const yTicks = 5;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxBarValue / yTicks) * i);

  const linePoints = series.map((d, i) => {
    const x = padLeft + step * i + step / 2;
    const roas = roasSeries[i];
    const y = padTop + innerH - (roas / maxRoas) * innerH;
    return [x, y];
  });

  const hoverItem = hoverIdx != null ? series[hoverIdx] : null;
  const hoverRoas = hoverIdx != null ? roasSeries[hoverIdx] : null;
  const hoverPurchases = hoverItem ? Number(hoverItem.purchases || 0) : 0;
  const hoverCpa = hoverItem && hoverPurchases > 0 ? Number(hoverItem.spend || 0) / hoverPurchases : null;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h3 className="text-white text-[15px] font-semibold">Gasto vs facturación por día</h3>
          <p className="text-app-secondary text-[12px] mt-1">Barras: spend (azul) y revenue ads (verde) · línea: ROAS</p>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="text-right">
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Spend total</p>
            <p className="text-white text-[18px] font-bold tabular-nums leading-none mt-1">{fmtMoneyShort(totalSpend)}</p>
          </div>
          <div className="text-right">
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Revenue ads</p>
            <p className="text-emerald-300 text-[18px] font-bold tabular-nums leading-none mt-1">{fmtMoneyShort(totalRevenue)}</p>
          </div>
          <div className="text-right">
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">ROAS período</p>
            <p className={`text-[18px] font-bold tabular-nums leading-none mt-1 ${totalRoas >= 2 ? 'text-emerald-300' : totalRoas >= 1 ? 'text-amber-300' : 'text-red-300'}`}>
              {fmtMultiple(totalRoas)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          style={{ display: 'block', overflow: 'visible' }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="metaSpendBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="metaRevenueBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="roasArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
            </linearGradient>
            <filter id="metaLineGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="metaBarShadow" x="-20%" y="-10%" width="140%" height="130%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <feOffset dy="3" />
              <feComponentTransfer><feFuncA type="linear" slope="0.3" /></feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid horizontal */}
          {tickValues.map((tv, i) => {
            const y = padTop + innerH - (tv / maxBarValue) * innerH;
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
                <text x={width - padRight + 12} y={y + 4} fill="#71717a" fontSize="11" className="tabular-nums">
                  {fmtMoneyShort(tv)}
                </text>
              </g>
            );
          })}

          {/* Etiqueta eje secundario ROAS */}
          <text x={padLeft - 4} y={padTop - 8} fill="#fbbf24" fontSize="10" textAnchor="start" letterSpacing="1.5">
            ROAS · max {fmtMultiple(maxRoas)}
          </text>

          {/* Barras spend + revenue por día */}
          {series.map((d, i) => {
            const spend = Number(d.spend || 0);
            const revenue = Number(d.purchaseValue || 0);
            const hSpend = (spend / maxBarValue) * innerH;
            const hRevenue = (revenue / maxBarValue) * innerH;
            const groupX = padLeft + step * i + (step - groupWidth) / 2;
            const xSpend = groupX;
            const xRevenue = groupX + barWidth + 4;
            const ySpend = padTop + innerH - hSpend;
            const yRevenue = padTop + innerH - hRevenue;
            const hovered = hoverIdx === i;
            const animDelay = i * 35;

            return (
              <g key={d._id || i} onMouseEnter={() => setHoverIdx(i)}>
                {/* Hit area */}
                <rect x={padLeft + step * i} y={padTop} width={step} height={innerH + 20} fill="transparent" />

                {/* Spend */}
                <rect
                  x={xSpend}
                  y={mounted ? ySpend : padTop + innerH}
                  width={barWidth}
                  height={mounted ? Math.max(hSpend, 1) : 0}
                  fill="url(#metaSpendBar)"
                  rx="2"
                  filter="url(#metaBarShadow)"
                  opacity={hovered ? 1 : 0.85}
                  style={{
                    transition: `y 700ms cubic-bezier(0.22,1,0.36,1) ${animDelay}ms, height 700ms cubic-bezier(0.22,1,0.36,1) ${animDelay}ms`,
                  }}
                />
                {hSpend > 6 && mounted && (
                  <rect x={xSpend} y={ySpend} width={barWidth} height={2} fill="#93c5fd" rx="1" opacity={hovered ? 1 : 0.7} />
                )}

                {/* Revenue */}
                <rect
                  x={xRevenue}
                  y={mounted ? yRevenue : padTop + innerH}
                  width={barWidth}
                  height={mounted ? Math.max(hRevenue, 1) : 0}
                  fill="url(#metaRevenueBar)"
                  rx="2"
                  filter="url(#metaBarShadow)"
                  opacity={hovered ? 1 : 0.85}
                  style={{
                    transition: `y 700ms cubic-bezier(0.22,1,0.36,1) ${animDelay + 50}ms, height 700ms cubic-bezier(0.22,1,0.36,1) ${animDelay + 50}ms`,
                  }}
                />
                {hRevenue > 6 && mounted && (
                  <rect x={xRevenue} y={yRevenue} width={barWidth} height={2} fill="#6ee7b7" rx="1" opacity={hovered ? 1 : 0.7} />
                )}

                {/* Valores siempre visibles si hay pocos días */}
                {mounted && spend > 0 && (showValuesAlways || hovered) && (
                  <text
                    x={xSpend + barWidth / 2}
                    y={ySpend - 6}
                    fill={hovered ? '#fff' : '#dbeafe'}
                    fontSize="10.5"
                    fontWeight="600"
                    textAnchor="middle"
                    className="tabular-nums"
                    style={{ paintOrder: 'stroke', stroke: '#0a0a0a', strokeWidth: '3px', strokeLinejoin: 'round' }}
                  >
                    {fmtMoneyShort(spend)}
                  </text>
                )}
                {mounted && revenue > 0 && (showValuesAlways || hovered) && (
                  <text
                    x={xRevenue + barWidth / 2}
                    y={yRevenue - 6}
                    fill={hovered ? '#fff' : '#a7f3d0'}
                    fontSize="10.5"
                    fontWeight="600"
                    textAnchor="middle"
                    className="tabular-nums"
                    style={{ paintOrder: 'stroke', stroke: '#0a0a0a', strokeWidth: '3px', strokeLinejoin: 'round' }}
                  >
                    {fmtMoneyShort(revenue)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Área debajo de la línea ROAS */}
          {mounted && (
            <path
              d={
                linePoints.length > 0
                  ? `M ${linePoints[0][0]} ${padTop + innerH} L ${linePoints.map(([x, y]) => `${x} ${y}`).join(' L ')} L ${linePoints[linePoints.length - 1][0]} ${padTop + innerH} Z`
                  : ''
              }
              fill="url(#roasArea)"
              style={{ opacity: mounted ? 1 : 0, transition: 'opacity 800ms ease 500ms' }}
            />
          )}

          {/* Línea ROAS */}
          {mounted && (
            <g style={{ opacity: mounted ? 1 : 0, transition: 'opacity 700ms ease 400ms' }}>
              <polyline
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#metaLineGlow)"
                points={linePoints.map(([x, y]) => `${x},${y}`).join(' ')}
              />
              {linePoints.map(([x, y], i) => {
                const hovered = hoverIdx === i;
                const roas = roasSeries[i];
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
                    />
                    {roas > 0 && (showValuesAlways || hovered) && (
                      <text
                        x={x}
                        y={y - 10}
                        fill={hovered ? '#fde68a' : '#fbbf24'}
                        fontSize="10.5"
                        fontWeight="700"
                        textAnchor="middle"
                        className="tabular-nums"
                        style={{ paintOrder: 'stroke', stroke: '#0a0a0a', strokeWidth: '3.5px', strokeLinejoin: 'round' }}
                      >
                        {fmtMultiple(roas, 1)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* Línea vertical hover */}
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
                <text x={x} y={padTop + innerH + 26} fill={accent} fontSize="12" textAnchor="middle" fontWeight={isHovered || todayMark ? 600 : 500} className="tabular-nums">
                  {shortDate(d._id)}
                </text>
                <text x={x} y={padTop + innerH + 42} fill="#71717a" fontSize="10" textAnchor="middle" letterSpacing="0.12em">
                  {dayOfWeek(d._id)}
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
              borderTop: '2px solid #fbbf24',
              padding: '12px 14px',
            }}
          >
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <p className="text-app-secondary text-[12px] font-semibold">
                {dayOfWeek(hoverItem._id)} {shortDate(hoverItem._id)}
              </p>
              <span className={`text-[10px] font-bold tabular-nums ${hoverRoas >= 2 ? 'text-emerald-300' : hoverRoas >= 1 ? 'text-amber-300' : 'text-red-300'}`}>
                ROAS {fmtMultiple(hoverRoas)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
              <span className="text-app-secondary">Spend</span>
              <span className="text-blue-300 text-right tabular-nums font-semibold">{fmtMoney(hoverItem.spend)}</span>
              <span className="text-app-secondary">Revenue</span>
              <span className="text-emerald-300 text-right tabular-nums font-semibold">{fmtMoney(hoverItem.purchaseValue)}</span>
              <span className="text-app-secondary">Compras</span>
              <span className="text-white text-right tabular-nums">{hoverPurchases}</span>
              {hoverCpa != null && (
                <>
                  <span className="text-app-secondary">CPA</span>
                  <span className="text-white text-right tabular-nums">{fmtMoney(hoverCpa)}</span>
                </>
              )}
              {Number(hoverItem.atc || 0) > 0 && (
                <>
                  <span className="text-app-muted text-[11px]">ATC</span>
                  <span className="text-app-secondary text-right tabular-nums text-[11px]">{Number(hoverItem.atc || 0).toLocaleString('es-AR')}</span>
                </>
              )}
              {Number(hoverItem.checkouts || 0) > 0 && (
                <>
                  <span className="text-app-muted text-[11px]">Checkouts</span>
                  <span className="text-app-secondary text-right tabular-nums text-[11px]">{Number(hoverItem.checkouts || 0).toLocaleString('es-AR')}</span>
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
          Spend
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 rounded-sm" style={{ background: 'linear-gradient(180deg, #34d399, #059669)' }} />
          Revenue ads
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-[2.5px] rounded-full bg-amber-400" />
          ROAS
        </span>
      </div>
    </div>
  );
}
