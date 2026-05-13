import { useMemo, useState, useEffect } from 'react';

/**
 * Chart compacto de una sola línea: evolución del CVR (purchase rate de Meta) por día.
 *
 * Usa el mismo dataset `dailyMetrics` que RoasTimelineChart — un solo fetch en Dashboard.
 *
 * Props:
 *   data: array de DailyMetric con { date, conversionRate, metaPurchases, linkClicks }
 *   periodLabel: string para header
 */

function fmtPct(v, digits = 2) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(digits).replace('.', ',')}%`;
}
function fmtNum(v) {
  if (v == null || isNaN(v)) return '0';
  return Number(v).toLocaleString('es-AR');
}

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function parseDate(s) {
  if (!s) return null;
  const str = typeof s === 'string' ? s.slice(0, 10) : s;
  const [y, m, d] = String(str).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function dateKey(s) { return typeof s === 'string' ? s.slice(0, 10) : ''; }
function shortDate(s) {
  const d = parseDate(s);
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function dayOfWeek(s) { const d = parseDate(s); return d ? DOW[d.getDay()] : ''; }

function toneForCvr(v) {
  if (v == null || isNaN(v)) return 'neutral';
  if (v >= 1) return 'good';
  if (v >= 0.3) return 'warn';
  return 'bad';
}
const TONE_FILL = {
  good: '#34d399',
  warn: '#fbbf24',
  bad: '#f87171',
  neutral: '#9ca3af',
};

export default function CvrTimelineChart({ data = [], periodLabel = '' }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const [mounted, setMounted] = useState(false);

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
      <div className="card p-6 text-center">
        <p className="text-[13px] text-gray-200">Sin actividad diaria en el período.</p>
      </div>
    );
  }

  const values = series.map((d) => Number(d.conversionRate || 0));
  const totalClicks = series.reduce((s, d) => s + Number(d.linkClicks || d.clicks || 0), 0);
  const totalPurchases = series.reduce((s, d) => s + Number(d.metaPurchases || 0), 0);
  const periodCvr = totalClicks > 0 ? (totalPurchases / totalClicks) * 100 : 0;

  // Min de 0.5 para que la línea no quede pegada al techo cuando hay días buenos
  const maxCvr = Math.max(...values, 0.5) * 1.15;

  const width = 600;
  const height = 280;
  const padTop = 24;
  const padBottom = 42;
  const padLeft = 44;
  const padRight = 16;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const step = innerW / Math.max(series.length - 1, 1);

  // Línea promedio del período
  const avgCvr = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  const avgY = padTop + innerH - (avgCvr / maxCvr) * innerH;

  const points = series.map((d, i) => {
    const x = padLeft + step * i;
    const v = Number(d.conversionRate || 0);
    const y = padTop + innerH - (v / maxCvr) * innerH;
    return [x, y, v];
  });

  // Path línea
  const linePath = points.length > 0
    ? `M ${points[0][0]} ${points[0][1]} ` + points.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' ')
    : '';
  // Path área debajo (gradient)
  const areaPath = points.length > 0
    ? `M ${points[0][0]} ${padTop + innerH} L ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} L ${points[points.length - 1][0]} ${padTop + innerH} Z`
    : '';

  const yTicks = 4;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxCvr / yTicks) * i);

  const showLabels = series.length <= 14;
  const hoverItem = hoverIdx != null ? series[hoverIdx] : null;
  const periodTone = toneForCvr(periodCvr);

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className="text-white text-[14px] font-semibold">Evolución de CVR</h3>
          <p className="text-gray-200 text-[12px] mt-1">Compras / clicks al link · por día</p>
        </div>
        <div className="text-right">
          <p className="text-gray-300 text-[10px] uppercase tracking-[0.16em]">CVR período</p>
          <p className={`text-[18px] font-bold tabular-nums leading-none mt-1
            ${periodTone === 'good' ? 'text-emerald-400'
              : periodTone === 'warn' ? 'text-amber-300'
              : periodTone === 'bad' ? 'text-red-400'
              : 'text-white'}`}>
            {fmtPct(periodCvr, 2)}
          </p>
          {periodLabel && <p className="text-gray-300 text-[10px] mt-1">{periodLabel}</p>}
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
            <linearGradient id="cvr-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
            </linearGradient>
            <filter id="cvr-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Grid Y */}
          {tickValues.map((tv, i) => {
            const y = padTop + innerH - (tv / maxCvr) * innerH;
            return (
              <g key={`g-${i}`}>
                <line
                  x1={padLeft} y1={y}
                  x2={width - padRight} y2={y}
                  stroke={i === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'}
                  strokeWidth="1"
                  strokeDasharray={i === 0 ? '' : '3 5'}
                />
                <text x={padLeft - 6} y={y + 4} fill="#9ca3af" fontSize="10" textAnchor="end" className="tabular-nums">
                  {fmtPct(tv, 1)}
                </text>
              </g>
            );
          })}

          {/* Promedio */}
          {avgCvr > 0 && mounted && (
            <g>
              <line
                x1={padLeft} y1={avgY}
                x2={width - padRight} y2={avgY}
                stroke="#fbbf24" strokeWidth="1" strokeDasharray="4 6"
                opacity="0.45"
              />
              <text x={width - padRight - 4} y={avgY - 4} fill="#fbbf24" fontSize="9.5" textAnchor="end" opacity="0.8" className="tabular-nums">
                prom {fmtPct(avgCvr, 2)}
              </text>
            </g>
          )}

          {/* Área */}
          {mounted && (
            <path
              d={areaPath}
              fill="url(#cvr-area)"
              style={{ opacity: mounted ? 1 : 0, transition: 'opacity 700ms ease 300ms' }}
            />
          )}

          {/* Línea */}
          {mounted && (
            <path
              d={linePath}
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#cvr-glow)"
              style={{ opacity: mounted ? 1 : 0, transition: 'opacity 700ms ease 200ms' }}
            />
          )}

          {/* Puntos */}
          {mounted && points.map(([x, y, v], i) => {
            const hovered = hoverIdx === i;
            const tone = toneForCvr(v);
            return (
              <g key={`pt-${i}`} onMouseEnter={() => setHoverIdx(i)}>
                <rect
                  x={x - step / 2}
                  y={padTop}
                  width={step}
                  height={innerH + 10}
                  fill="transparent"
                />
                <circle
                  cx={x} cy={y}
                  r={hovered ? 5 : (showLabels ? 3.5 : 3)}
                  fill={TONE_FILL[tone]}
                  stroke="#0a0a0a"
                  strokeWidth="1.5"
                />
                {showLabels && v > 0 && (
                  <text
                    x={x} y={y - 10}
                    fill={hovered ? '#fff' : '#dbeafe'}
                    fontSize="10.5" fontWeight="700"
                    textAnchor="middle"
                    className="tabular-nums"
                    style={{ paintOrder: 'stroke', stroke: '#0a0a0a', strokeWidth: '3px', strokeLinejoin: 'round' }}
                  >
                    {fmtPct(v, 2)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Etiquetas X */}
          {series.map((d, i) => {
            const skip = series.length > 30 ? Math.ceil(series.length / 10) : (series.length > 14 ? 3 : 1);
            if (i % skip !== 0 && i !== series.length - 1) return null;
            const x = padLeft + step * i;
            return (
              <g key={`xl-${i}`}>
                <text x={x} y={padTop + innerH + 14} fill="#9ca3af" fontSize="10" textAnchor="middle" className="tabular-nums">
                  {shortDate(d.date)}
                </text>
              </g>
            );
          })}

          {/* Hover guide */}
          {hoverIdx != null && (
            <line
              x1={points[hoverIdx][0]} y1={padTop}
              x2={points[hoverIdx][0]} y2={padTop + innerH}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1" strokeDasharray="3 4"
              pointerEvents="none"
            />
          )}
        </svg>

        {hoverItem && (
          <div
            className="pointer-events-none absolute top-2 z-10 rounded-lg border border-white/10 bg-[#0f0f10] px-3 py-2 text-[11.5px] shadow-xl"
            style={{
              left: `${Math.min(Math.max(((points[hoverIdx][0]) / width) * 100, 10), 85)}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <p className="text-white font-semibold mb-0.5">
              {shortDate(hoverItem.date)} <span className="text-gray-300 font-normal">· {dayOfWeek(hoverItem.date)}</span>
            </p>
            <p className="flex items-center justify-between gap-4">
              <span className="text-gray-200">CVR</span>
              <span className={`tabular-nums font-bold
                ${toneForCvr(hoverItem.conversionRate) === 'good' ? 'text-emerald-300'
                  : toneForCvr(hoverItem.conversionRate) === 'warn' ? 'text-amber-300'
                  : 'text-red-300'}`}>
                {fmtPct(hoverItem.conversionRate, 2)}
              </span>
            </p>
            <p className="text-[10.5px] text-gray-300 mt-0.5">
              {fmtNum(hoverItem.metaPurchases)} compras · {fmtNum(hoverItem.linkClicks || hoverItem.clicks)} clicks
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
