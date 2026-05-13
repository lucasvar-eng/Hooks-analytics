import { useMemo, useState, useEffect } from 'react';

/**
 * Gráfica diaria con Ventas (TN) + Spend (Meta) como barras agrupadas
 * y ROAS real como línea encima (eje Y derecho).
 *
 * Va en el Resumen, entre el SourceMetricsRow de Tienda Nube y el de P&L.
 *
 * Props:
 *   data: array de DailyMetric con { date, revenue, adSpend, roas, trueRoas }
 *   periodLabel: string para el header (ej. "Últimos 30 días")
 */

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '$0';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}
function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '$0';
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
function fmtRoas(v) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(2).replace('.', ',')}×`;
}

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function parseDate(s) {
  if (!s) return null;
  // El backend devuelve ISO string. Tomamos solo YYYY-MM-DD para evitar problemas de timezone.
  const str = typeof s === 'string' ? s.slice(0, 10) : s;
  const [y, m, d] = String(str).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function dateKey(s) {
  return typeof s === 'string' ? s.slice(0, 10) : '';
}
function shortDate(s) {
  const d = parseDate(s);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function dayOfWeek(s) {
  const d = parseDate(s);
  return d ? DOW[d.getDay()] : '';
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

export default function RoasTimelineChart({ data = [], periodLabel = '' }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const [mounted, setMounted] = useState(false);
  // Toggle: 'gross' usa roas (revenue/adSpend) · 'true' usa trueRoas (netRevenue/adSpend)
  const [roasMode, setRoasMode] = useState('gross');

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  const series = useMemo(
    () => [...(data || [])].sort((a, b) => dateKey(a.date).localeCompare(dateKey(b.date))),
    [data]
  );

  if (!series.length) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px] text-gray-200">Sin actividad diaria en el período.</p>
      </div>
    );
  }

  const revenues = series.map((d) => Number(d.revenue || 0));
  const spends = series.map((d) => Number(d.adSpend || 0));
  const roasValues = series.map((d) => Number((roasMode === 'true' ? d.trueRoas : d.roas) || 0));

  const totalRevenue = revenues.reduce((s, v) => s + v, 0);
  const totalSpend = spends.reduce((s, v) => s + v, 0);
  const totalRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  const maxMoney = niceMax(Math.max(...revenues, ...spends, 1));
  const maxRoas = Math.max(...roasValues, 1) * 1.15;

  const showValuesAlways = series.length <= 14;

  // Geometría
  const width = 1200;
  const height = 380;
  const padTop = 36;
  const padBottom = 60;
  const padLeft = 60;
  const padRight = 60;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  // 2 barras agrupadas por día
  const groupWidth = (innerW / series.length) * 0.74;
  const barWidth = Math.max(8, groupWidth / 2 - 1);
  const step = innerW / series.length;

  const yTicks = 5;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxMoney / yTicks) * i);

  // Línea ROAS (eje derecho)
  const linePoints = series.map((d, i) => {
    const x = padLeft + step * i + step / 2;
    const v = Number((roasMode === 'true' ? d.trueRoas : d.roas) || 0);
    const y = padTop + innerH - (v / maxRoas) * innerH;
    return [x, y, v];
  });

  // Path línea ROAS
  const linePath = linePoints.length > 0
    ? `M ${linePoints[0][0]} ${linePoints[0][1]} ` +
      linePoints.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' ')
    : '';

  // Referencia ROAS = 1 (breakeven naive)
  const breakRoasY = padTop + innerH - (1 / maxRoas) * innerH;

  const hoverItem = hoverIdx != null ? series[hoverIdx] : null;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h3 className="text-white text-[15px] font-semibold">Ventas, inversión y ROAS por día</h3>
          <p className="text-gray-200 text-[12px] mt-1">
            Cruce diario Tienda Nube + Meta Ads — pasá el mouse sobre cualquier día para ver el detalle
          </p>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="text-right">
            <p className="text-gray-300 text-[10px] uppercase tracking-[0.16em]">Ventas totales</p>
            <p className="text-blue-300 text-[18px] font-bold tabular-nums leading-none mt-1">{fmtMoneyShort(totalRevenue)}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-300 text-[10px] uppercase tracking-[0.16em]">Spend total</p>
            <p className="text-red-300 text-[18px] font-bold tabular-nums leading-none mt-1">{fmtMoneyShort(totalSpend)}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-300 text-[10px] uppercase tracking-[0.16em]">ROAS período</p>
            <p className={`text-[18px] font-bold tabular-nums leading-none mt-1
              ${totalRoas >= 2 ? 'text-emerald-400' : totalRoas >= 1 ? 'text-amber-300' : 'text-red-400'}`}>
              {fmtRoas(totalRoas)}
            </p>
          </div>
          {periodLabel && (
            <div className="text-right">
              <p className="text-gray-300 text-[10px] uppercase tracking-[0.16em]">Período</p>
              <p className="text-white text-[12.5px] font-semibold leading-none mt-1.5">{periodLabel}</p>
            </div>
          )}
        </div>
      </div>

      {/* Leyenda + toggle */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-5 text-[11.5px] text-gray-200">
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(180deg, #60a5fa, #1d4ed8)' }} />
            Ventas (Tienda Nube)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(180deg, #f87171, #b91c1c)' }} />
            Inversión (Meta Ads)
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-[2px] rounded-sm bg-amber-400" />
            ROAS {roasMode === 'true' ? 'real' : 'bruto'}
          </span>
        </div>
        <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setRoasMode('gross')}
            className={`px-3 py-1 rounded-full transition ${roasMode === 'gross' ? 'bg-blue-500/20 text-blue-200' : 'text-gray-300 hover:text-white'}`}
          >
            ROAS bruto
          </button>
          <button
            type="button"
            onClick={() => setRoasMode('true')}
            className={`px-3 py-1 rounded-full transition ${roasMode === 'true' ? 'bg-blue-500/20 text-blue-200' : 'text-gray-300 hover:text-white'}`}
          >
            ROAS real
          </button>
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
            <linearGradient id="rt-rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="rt-spend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f87171" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#b91c1c" stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="rt-revHover" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#93c5fd" stopOpacity="1" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="rt-spendHover" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fca5a5" stopOpacity="1" />
              <stop offset="100%" stopColor="#dc2626" stopOpacity="0.75" />
            </linearGradient>
            <filter id="rt-lineGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid horizontal (eje izquierdo $) */}
          {tickValues.map((tv, i) => {
            const y = padTop + innerH - (tv / maxMoney) * innerH;
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
                <text x={padLeft - 8} y={y + 4} fill="#9ca3af" fontSize="11" textAnchor="end" className="tabular-nums">
                  {fmtMoneyShort(tv)}
                </text>
              </g>
            );
          })}

          {/* Eje derecho — escala ROAS */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => {
            const v = maxRoas * frac;
            const y = padTop + innerH - frac * innerH;
            return (
              <text
                key={`roas-tick-${i}`}
                x={width - padRight + 8}
                y={y + 4}
                fill="#f59e0b"
                fontSize="11"
                textAnchor="start"
                className="tabular-nums"
                opacity={frac === 0 ? 0 : 0.85}
              >
                {fmtRoas(v)}
              </text>
            );
          })}

          {/* Línea de breakeven ROAS = 1 */}
          {1 < maxRoas && (
            <g>
              <line
                x1={padLeft}
                y1={breakRoasY}
                x2={width - padRight}
                y2={breakRoasY}
                stroke="#f59e0b"
                strokeWidth="1"
                strokeDasharray="4 6"
                opacity={mounted ? 0.4 : 0}
                style={{ transition: 'opacity 700ms ease 500ms' }}
              />
              <text
                x={width - padRight - 6}
                y={breakRoasY - 4}
                fill="#f59e0b"
                fontSize="10"
                textAnchor="end"
                opacity={mounted ? 0.7 : 0}
                style={{ transition: 'opacity 700ms ease 500ms' }}
              >
                ROAS 1×
              </text>
            </g>
          )}

          {/* Barras agrupadas */}
          {series.map((d, i) => {
            const rev = Number(d.revenue || 0);
            const spd = Number(d.adSpend || 0);
            const hovered = hoverIdx === i;
            const xCenter = padLeft + step * i + step / 2;
            const xRev = xCenter - barWidth - 0.5;
            const xSpd = xCenter + 0.5;
            const yRev = padTop + innerH - (rev / maxMoney) * innerH;
            const ySpd = padTop + innerH - (spd / maxMoney) * innerH;
            const hRev = (rev / maxMoney) * innerH;
            const hSpd = (spd / maxMoney) * innerH;
            const animDelay = i * 30;

            return (
              <g key={dateKey(d.date) || i} onMouseEnter={() => setHoverIdx(i)}>
                {/* hit area */}
                <rect
                  x={padLeft + step * i}
                  y={padTop}
                  width={step}
                  height={innerH + 20}
                  fill="transparent"
                />
                {/* Ventas */}
                {rev > 0 && (
                  <rect
                    x={xRev}
                    y={mounted ? yRev : padTop + innerH}
                    width={barWidth}
                    height={mounted ? Math.max(hRev, 1.5) : 0}
                    fill={hovered ? 'url(#rt-revHover)' : 'url(#rt-rev)'}
                    rx="2"
                    style={{
                      transition: `y 650ms cubic-bezier(0.22,1,0.36,1) ${animDelay}ms, height 650ms cubic-bezier(0.22,1,0.36,1) ${animDelay}ms`,
                    }}
                  />
                )}
                {/* Spend */}
                {spd > 0 && (
                  <rect
                    x={xSpd}
                    y={mounted ? ySpd : padTop + innerH}
                    width={barWidth}
                    height={mounted ? Math.max(hSpd, 1.5) : 0}
                    fill={hovered ? 'url(#rt-spendHover)' : 'url(#rt-spend)'}
                    rx="2"
                    style={{
                      transition: `y 650ms cubic-bezier(0.22,1,0.36,1) ${animDelay}ms, height 650ms cubic-bezier(0.22,1,0.36,1) ${animDelay}ms`,
                    }}
                  />
                )}
                {/* Etiquetas de valor encima de las barras — siempre visibles */}
                {mounted && rev > 0 && (
                  <text
                    x={xRev + barWidth / 2}
                    y={yRev - 6}
                    fill={hovered ? '#dbeafe' : '#93c5fd'}
                    fontSize={showValuesAlways ? '11' : '9.5'}
                    fontWeight="600"
                    textAnchor="middle"
                    className="tabular-nums"
                    style={{
                      paintOrder: 'stroke',
                      stroke: '#0a0a0a',
                      strokeWidth: '3px',
                      strokeLinejoin: 'round',
                    }}
                  >
                    {fmtMoneyShort(rev)}
                  </text>
                )}
                {mounted && spd > 0 && (
                  <text
                    x={xSpd + barWidth / 2}
                    y={ySpd - 6}
                    fill={hovered ? '#fecaca' : '#fca5a5'}
                    fontSize={showValuesAlways ? '11' : '9.5'}
                    fontWeight="600"
                    textAnchor="middle"
                    className="tabular-nums"
                    style={{
                      paintOrder: 'stroke',
                      stroke: '#0a0a0a',
                      strokeWidth: '3px',
                      strokeLinejoin: 'round',
                    }}
                  >
                    {fmtMoneyShort(spd)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Línea ROAS encima */}
          {mounted && linePath && (
            <>
              <path
                d={linePath}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#rt-lineGlow)"
                style={{ opacity: mounted ? 1 : 0, transition: 'opacity 700ms ease 350ms' }}
              />
              {/* Puntos ROAS */}
              {linePoints.map(([x, y, v], i) => {
                const hovered = hoverIdx === i;
                return (
                  <circle
                    key={`pt-${i}`}
                    cx={x}
                    cy={y}
                    r={hovered ? 4.5 : (showValuesAlways ? 3 : 2.5)}
                    fill={v >= 1 ? '#fbbf24' : '#f97316'}
                    stroke="#0a0a0a"
                    strokeWidth="1.5"
                    opacity={mounted ? 1 : 0}
                    style={{ transition: 'opacity 700ms ease 400ms' }}
                  />
                );
              })}
              {/* Valor ROAS si caben (períodos cortos) o en hover */}
              {linePoints.map(([x, y, v], i) => {
                const hovered = hoverIdx === i;
                if (!showValuesAlways && !hovered) return null;
                if (v <= 0) return null;
                return (
                  <text
                    key={`rt-val-${i}`}
                    x={x}
                    y={y - 8}
                    fill={hovered ? '#fef3c7' : '#fbbf24'}
                    fontSize="10.5"
                    fontWeight="700"
                    textAnchor="middle"
                    className="tabular-nums"
                    style={{
                      paintOrder: 'stroke',
                      stroke: '#0a0a0a',
                      strokeWidth: '3px',
                      strokeLinejoin: 'round',
                    }}
                  >
                    {fmtRoas(v)}
                  </text>
                );
              })}
            </>
          )}

          {/* Etiquetas eje X */}
          {series.map((d, i) => {
            // Para que no se amontone, en períodos largos mostramos cada N días
            const skip = series.length > 30 ? Math.ceil(series.length / 15) : (series.length > 14 ? 2 : 1);
            if (i % skip !== 0 && i !== series.length - 1) return null;
            const x = padLeft + step * i + step / 2;
            return (
              <g key={`xlabel-${i}`}>
                <text x={x} y={padTop + innerH + 16} fill="#9ca3af" fontSize="11" textAnchor="middle" className="tabular-nums">
                  {shortDate(d.date)}
                </text>
                <text x={x} y={padTop + innerH + 30} fill="#6b7280" fontSize="9" textAnchor="middle">
                  {dayOfWeek(d.date)}
                </text>
              </g>
            );
          })}

          {/* Tooltip line */}
          {hoverIdx != null && (
            <line
              x1={padLeft + step * hoverIdx + step / 2}
              y1={padTop}
              x2={padLeft + step * hoverIdx + step / 2}
              y2={padTop + innerH}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1"
              strokeDasharray="3 4"
              pointerEvents="none"
            />
          )}
        </svg>

        {/* Tooltip flotante */}
        {hoverItem && (
          <div
            className="pointer-events-none absolute top-2 z-10 rounded-lg border border-white/10 bg-[#0f0f10] px-3.5 py-2.5 text-[11.5px] shadow-xl"
            style={{
              left: `${Math.min(
                Math.max(((padLeft + step * hoverIdx + step / 2) / width) * 100, 10),
                85,
              )}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <p className="text-white font-semibold mb-1">
              {shortDate(hoverItem.date)} <span className="text-gray-300 font-normal">· {dayOfWeek(hoverItem.date)}</span>
            </p>
            <p className="flex items-center justify-between gap-4 text-blue-300">
              <span>Ventas</span><span className="tabular-nums font-semibold">{fmtMoney(hoverItem.revenue)}</span>
            </p>
            <p className="flex items-center justify-between gap-4 text-red-300">
              <span>Spend</span><span className="tabular-nums font-semibold">{fmtMoney(hoverItem.adSpend)}</span>
            </p>
            <p className="flex items-center justify-between gap-4 text-amber-300 mt-0.5 pt-1 border-t border-white/[0.06]">
              <span>ROAS {roasMode === 'true' ? 'real' : 'bruto'}</span>
              <span className="tabular-nums font-bold">{fmtRoas(roasMode === 'true' ? hoverItem.trueRoas : hoverItem.roas)}</span>
            </p>
            <p className="text-[10.5px] text-gray-300 mt-1">
              {Number(hoverItem.ordenes || 0)} órdenes · {Number(hoverItem.metaPurchases || 0)} compras Meta
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
