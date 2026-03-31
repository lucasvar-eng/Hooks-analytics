import { useMemo, useState } from 'react';
import LatestSalesTable from '../dashboard/LatestSalesTable';

function formatValue(value, prefix = '', suffix = '', decimals = 0, compact = false) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const num = Number(value);
  let formatted;
  if (compact && Math.abs(num) >= 1000000) formatted = `${(num / 1000000).toFixed(1)}M`;
  else if (compact && Math.abs(num) >= 1000) formatted = `${(num / 1000).toFixed(1)}K`;
  else {
    formatted = num.toLocaleString('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return `${prefix}${formatted}${suffix}`;
}

function formatCompactAxis(value) {
  return formatValue(value, '', '', Math.abs(value) < 10 ? 1 : 0, true);
}

function formatShortDate(dateLike) {
  const date = new Date(dateLike);
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function getMetricMeta(widget) {
  const cfg = widget.config || {};
  return {
    label: cfg.metricLabel || widget.title,
    prefix: cfg.prefix || '',
    suffix: cfg.suffix || '',
    decimals: cfg.decimals || 0,
    compact: Boolean(cfg.compact),
  };
}

function getSeries(widget, dailyMetrics = []) {
  const cfg = widget.config || {};
  const metricKey = cfg.metricKey;
  if (!metricKey) return [];

  return dailyMetrics.map((item) => ({
    date: item.date,
    label: formatShortDate(item.date),
    value: Number(item?.[metricKey] || 0),
    raw: item,
  }));
}

function buildPolylinePoints(values, width, height, padding) {
  const safe = values.length ? values : [0];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const range = max - min || 1;

  return values.map((value, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return [x, y];
  });
}

function buildComparisonPoints(currentSeries, previousSeries, width, height, padding) {
  const merged = [...currentSeries.map((item) => item.value), ...previousSeries.map((item) => item.value)];
  const safe = merged.length ? merged : [0];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const range = max - min || 1;

  const toPoints = (series) =>
    series.map((item, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(series.length - 1, 1);
      const y = height - padding - ((item.value - min) / range) * (height - padding * 2);
      return [x, y];
    });

  return {
    min,
    max,
    currentPoints: toPoints(currentSeries),
    previousPoints: toPoints(previousSeries),
  };
}

function TargetBar({ value, target, inverse }) {
  if (!target || value == null) return null;
  let pct;
  if (inverse) {
    pct = Math.min(100, Math.max(0, ((target - value) / target) * 100 + 100));
  } else {
    pct = Math.min(100, (value / target) * 100);
  }
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="mt-2">
      <div className="h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-gray-600">
          Target: {inverse ? 'máx ' : ''}{formatValue(target, '', inverse ? '' : '', 1)}
        </span>
        <span className="text-[9px] text-gray-600">
          {pct >= 100 ? '+' : ''}{Math.round(pct - 100)}%
        </span>
      </div>
    </div>
  );
}

function KPIWidget({ widget, current, deltas, objetivos }) {
  const cfg = widget.config || {};
  const value = current[cfg.metricKey];
  const delta = deltas[cfg.metricKey];
  const kpis = objetivos?.kpis || {};
  const target = cfg.targetKey ? kpis[cfg.targetKey] : null;
  const deltaColor = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-gray-600';
  const deltaArrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '';

  return (
    <div>
      <p className="kpi-label mb-1.5">{widget.title}</p>
      <p className="text-[22px] font-bold text-white leading-none tracking-tight tabular-nums">
        {formatValue(value, cfg.prefix, cfg.suffix, cfg.decimals, cfg.compact)}
      </p>
      {delta !== undefined && delta !== null && (
        <p className={`text-[11px] font-semibold mt-1 ${deltaColor}`}>
          {deltaArrow} {Math.abs(delta).toFixed(1)}%
        </p>
      )}
      {target && <TargetBar value={value} target={target} inverse={cfg.inverse} />}
    </div>
  );
}

function KPIGroupWidget({ widget, current, deltas }) {
  const metrics = widget.config?.metrics || [];

  return (
    <div>
      <p className="kpi-label mb-3">{widget.title}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-3">
        {metrics.map((m) => {
          const value = current[m.key];
          const delta = deltas[m.key];
          const deltaColor = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-gray-600';
          const deltaArrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '';

          return (
            <div key={m.key + m.label}>
              <p className="kpi-label">{m.label}</p>
              <p className="text-[15px] font-bold text-white tabular-nums leading-tight mt-0.5">
                {formatValue(value, m.prefix, m.suffix, m.decimals, m.compact)}
              </p>
              {delta !== undefined && delta !== null && (
                <p className={`text-[10px] font-semibold ${deltaColor}`}>
                  {deltaArrow} {Math.abs(delta).toFixed(1)}%
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TableWidget({ widget, storeId, from, to }) {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const cfg = widget.config || {};

  if (cfg.dataSource === 'latest-sales') {
    return (
      <LatestSalesTable
        storeId={storeId}
        from={from}
        to={to}
        onOrderClick={setSelectedOrder}
      />
    );
  }

  return (
    <div className="text-[11px] text-gray-600 text-center py-6">
      Tabla: {cfg.dataSource || 'sin configurar'}
    </div>
  );
}

function NoteWidget({ widget }) {
  return (
    <div>
      <p className="kpi-label mb-2">{widget.title}</p>
      <p className="text-[11px] text-gray-500 leading-relaxed whitespace-pre-wrap">
        {widget.config?.text || 'Sin contenido.'}
      </p>
    </div>
  );
}

function SeparatorWidget({ widget }) {
  return <p className="section-label">{widget.title}</p>;
}

function ChartShell({ title, subtitle, children, footer }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="kpi-label mb-1">{title}</p>
          {subtitle ? <p className="text-[10px] text-gray-500">{subtitle}</p> : null}
        </div>
      </div>
      {children}
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="h-[180px] rounded-2xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-center text-[11px] text-gray-600">
      Sin datos para este rango
    </div>
  );
}

function LineLikeChartWidget({ widget, current, dailyMetrics, mode = 'line' }) {
  const meta = getMetricMeta(widget);
  const series = useMemo(() => getSeries(widget, dailyMetrics), [widget, dailyMetrics]);

  if (!series.length) {
    return (
      <ChartShell title={widget.title} subtitle={meta.label}>
        <EmptyChartState />
      </ChartShell>
    );
  }

  const width = 560;
  const height = 180;
  const padding = 18;
  const points = buildPolylinePoints(series.map((item) => item.value), width, height, padding);
  const pointString = points.map(([x, y]) => `${x},${y}`).join(' ');
  const areaPath = `${pointString} ${width - padding},${height - padding} ${padding},${height - padding}`;
  const lastPoint = points[points.length - 1];
  const maxValue = Math.max(...series.map((item) => item.value));
  const minValue = Math.min(...series.map((item) => item.value));

  return (
    <ChartShell
      title={widget.title}
      subtitle={`${meta.label} diario`}
      footer={
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>Mín: {formatValue(minValue, meta.prefix, meta.suffix, meta.decimals, meta.compact)}</span>
          <span>Máx: {formatValue(maxValue, meta.prefix, meta.suffix, meta.decimals, meta.compact)}</span>
          <span>Último: {formatValue(series.at(-1)?.value, meta.prefix, meta.suffix, meta.decimals, meta.compact)}</span>
        </div>
      }
    >
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[180px] overflow-visible">
          {[0.2, 0.4, 0.6, 0.8].map((step) => (
            <line
              key={step}
              x1={padding}
              y1={height - padding - step * (height - padding * 2)}
              x2={width - padding}
              y2={height - padding - step * (height - padding * 2)}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 6"
            />
          ))}
          {mode === 'area' ? (
            <polygon points={areaPath} fill="rgba(59,130,246,0.18)" />
          ) : null}
          {mode === 'bar' ? (
            points.map(([x, y], index) => {
              const barWidth = Math.max(8, (width - padding * 2) / Math.max(points.length * 1.8, 1));
              return (
                <rect
                  key={`${series[index].label}-${x}`}
                  x={x - barWidth / 2}
                  y={y}
                  width={barWidth}
                  height={height - padding - y}
                  rx="5"
                  fill="rgba(59,130,246,0.75)"
                />
              );
            })
          ) : (
            <>
              <polyline
                fill="none"
                stroke="rgba(59,130,246,0.95)"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={pointString}
              />
              {points.map(([x, y], index) => (
                <circle
                  key={`${series[index].label}-${x}`}
                  cx={x}
                  cy={y}
                  r="3.5"
                  fill="#0b0b0c"
                  stroke="rgba(96,165,250,1)"
                  strokeWidth="2"
                />
              ))}
            </>
          )}
          {lastPoint ? (
            <g>
              <circle cx={lastPoint[0]} cy={lastPoint[1]} r="5.5" fill="rgba(59,130,246,0.2)" />
              <circle cx={lastPoint[0]} cy={lastPoint[1]} r="3" fill="rgba(59,130,246,1)" />
            </g>
          ) : null}
        </svg>
        <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(series.length, 7)}, minmax(0, 1fr))` }}>
          {series.slice(-7).map((item) => (
            <div key={item.date} className="text-center">
              <p className="text-[9px] text-gray-600">{item.label}</p>
              <p className="text-[10px] text-gray-300 mt-0.5">{formatCompactAxis(item.value)}</p>
            </div>
          ))}
        </div>
      </div>
    </ChartShell>
  );
}

function DonutChartWidget({ widget, current }) {
  const metrics = widget.config?.metrics || [];
  const active = metrics
    .map((metric) => ({ ...metric, value: Number(current?.[metric.key] || 0) }))
    .filter((metric) => metric.value > 0);

  if (!active.length) {
    return (
      <ChartShell title={widget.title} subtitle="Distribución del período">
        <EmptyChartState />
      </ChartShell>
    );
  }

  const total = active.reduce((acc, item) => acc + item.value, 0);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  let progress = 0;

  return (
    <ChartShell title={widget.title} subtitle="Composición del período actual">
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col lg:flex-row gap-4 items-center">
        <div className="relative w-[132px] h-[132px] shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
            {active.map((item, index) => {
              const fraction = item.value / total;
              const dash = circumference * fraction;
              const offset = circumference * (1 - progress);
              progress += fraction;
              return (
                <circle
                  key={item.key}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={palette[index % palette.length]}
                  strokeWidth="14"
                  strokeDasharray={`${dash} ${circumference}`}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[9px] text-gray-500 uppercase tracking-[0.22em]">Total</span>
            <span className="text-[18px] font-semibold text-white">{formatCompactAxis(total)}</span>
          </div>
        </div>
        <div className="w-full space-y-2">
          {active.map((item, index) => (
            <div key={item.key} className="flex items-center justify-between gap-3 text-[11px]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: palette[index % palette.length] }} />
                <span className="text-gray-300 truncate">{item.label}</span>
              </div>
              <div className="text-right shrink-0">
                <p className="text-white font-medium">
                  {formatValue(item.value, item.prefix, item.suffix, item.decimals, item.compact)}
                </p>
                <p className="text-gray-500">{((item.value / total) * 100).toFixed(1)}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartShell>
  );
}

function getFunnelSeries(widget, current) {
  const preset = widget.config?.funnelPreset || 'meta';
  if (preset === 'meta') {
    return [
      { label: 'Impresiones', value: Number(current.impressions || 0) },
      { label: 'Link Clicks', value: Number(current.linkClicks || 0) },
      { label: 'Landing Views', value: Number(current.landingPageViews || 0) },
      { label: 'Add to Cart', value: Number(current.addToCart || 0) },
      { label: 'Checkout', value: Number(current.initiatedCheckout || 0) },
      { label: 'Compras Meta', value: Number(current.metaPurchases || 0) },
    ];
  }

  return [
    { label: 'Clicks', value: Number(current.clicks || 0) },
    { label: 'Landing Views', value: Number(current.landingPageViews || 0) },
    { label: 'Add to Cart', value: Number(current.addToCart || 0) },
    { label: 'Checkout', value: Number(current.initiatedCheckout || 0) },
    { label: 'Órdenes', value: Number(current.ordenesPositivas || 0) },
  ];
}

function FunnelChartWidget({ widget, current }) {
  const series = getFunnelSeries(widget, current).filter((step) => step.value > 0);

  if (!series.length) {
    return (
      <ChartShell title={widget.title} subtitle="Embudo del período">
        <EmptyChartState />
      </ChartShell>
    );
  }

  const top = series[0].value || 1;

  return (
    <ChartShell title={widget.title} subtitle="Embudo visual">
      <div className="space-y-2">
        {series.map((step, index) => {
          const pct = Math.max(10, (step.value / top) * 100);
          const conversion = index === 0 ? 100 : (step.value / (series[index - 1].value || 1)) * 100;
          return (
            <div key={step.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2.5">
              <div className="flex items-center justify-between mb-1.5 text-[10px]">
                <span className="text-gray-300 font-medium">{step.label}</span>
                <span className="text-gray-500">{conversion.toFixed(1)}% paso</span>
              </div>
              <div className="h-9 rounded-xl bg-white/[0.04] flex items-center px-3 text-white text-[11px] font-semibold" style={{ width: `${pct}%` }}>
                {formatCompactAxis(step.value)}
              </div>
            </div>
          );
        })}
      </div>
    </ChartShell>
  );
}

function HeatmapWidget({ widget, dailyMetrics }) {
  const meta = getMetricMeta(widget);
  const series = useMemo(() => getSeries(widget, dailyMetrics), [widget, dailyMetrics]);

  if (!series.length) {
    return (
      <ChartShell title={widget.title} subtitle={meta.label}>
        <EmptyChartState />
      </ChartShell>
    );
  }

  const values = series.map((item) => item.value);
  const max = Math.max(...values, 1);
  const rows = [];
  for (let index = 0; index < series.length; index += 7) {
    rows.push(series.slice(index, index + 7));
  }

  return (
    <ChartShell title={widget.title} subtitle={`${meta.label} por día`}>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="grid grid-cols-7 gap-2">
          {rows.flat().map((item) => {
            const intensity = item.value / max;
            const bg = `rgba(59,130,246,${0.12 + intensity * 0.78})`;
            return (
              <div
                key={item.date}
                className="aspect-square rounded-xl border border-white/[0.05] p-1.5 flex flex-col justify-between"
                style={{ backgroundColor: bg }}
                title={`${item.label}: ${formatValue(item.value, meta.prefix, meta.suffix, meta.decimals, meta.compact)}`}
              >
                <span className="text-[9px] text-white/80">{new Date(item.date).getDate()}</span>
                <span className="text-[9px] text-white font-medium leading-none">
                  {formatCompactAxis(item.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </ChartShell>
  );
}

function PeriodComparisonWidget({ widget, dailyMetrics, previousDailyMetrics }) {
  const meta = getMetricMeta(widget);
  const currentSeries = useMemo(() => getSeries(widget, dailyMetrics), [widget, dailyMetrics]);
  const priorRaw = useMemo(() => getSeries(widget, previousDailyMetrics), [widget, previousDailyMetrics]);
  const previousSeries = priorRaw.slice(-currentSeries.length);

  if (!currentSeries.length || !previousSeries.length) {
    return (
      <ChartShell title={widget.title} subtitle={`${meta.label} vs período anterior`}>
        <EmptyChartState />
      </ChartShell>
    );
  }

  const width = 560;
  const height = 180;
  const padding = 18;
  const { min, max, currentPoints, previousPoints } = buildComparisonPoints(currentSeries, previousSeries, width, height, padding);
  const currentString = currentPoints.map(([x, y]) => `${x},${y}`).join(' ');
  const previousString = previousPoints.map(([x, y]) => `${x},${y}`).join(' ');
  const currentTotal = currentSeries.reduce((acc, item) => acc + item.value, 0);
  const previousTotal = previousSeries.reduce((acc, item) => acc + item.value, 0);
  const deltaPct = previousTotal ? ((currentTotal - previousTotal) / Math.abs(previousTotal)) * 100 : 0;
  const deltaColor = deltaPct > 0 ? 'text-emerald-400' : deltaPct < 0 ? 'text-red-400' : 'text-gray-500';

  return (
    <ChartShell
      title={widget.title}
      subtitle={`${meta.label} actual vs anterior`}
      footer={
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>Actual: {formatValue(currentTotal, meta.prefix, meta.suffix, meta.decimals, meta.compact)}</span>
          <span>Anterior: {formatValue(previousTotal, meta.prefix, meta.suffix, meta.decimals, meta.compact)}</span>
          <span className={deltaColor}>{deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%</span>
        </div>
      }
    >
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[180px] overflow-visible">
          {[0.2, 0.4, 0.6, 0.8].map((step) => (
            <line
              key={step}
              x1={padding}
              y1={height - padding - step * (height - padding * 2)}
              x2={width - padding}
              y2={height - padding - step * (height - padding * 2)}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 6"
            />
          ))}
          <polyline
            fill="none"
            stroke="rgba(148,163,184,0.95)"
            strokeWidth="2.5"
            strokeDasharray="5 6"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={previousString}
          />
          <polyline
            fill="none"
            stroke="rgba(59,130,246,0.98)"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={currentString}
          />
        </svg>
        <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
          <span>Mín: {formatValue(min, meta.prefix, meta.suffix, meta.decimals, meta.compact)}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />Actual</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" />Anterior</span>
          </div>
          <span>Máx: {formatValue(max, meta.prefix, meta.suffix, meta.decimals, meta.compact)}</span>
        </div>
      </div>
    </ChartShell>
  );
}

export default function WidgetRenderer({
  widget,
  current,
  deltas,
  objetivos,
  storeId,
  from,
  to,
  dailyMetrics,
  previousDailyMetrics,
}) {
  switch (widget.type) {
    case 'kpi':
      return <KPIWidget widget={widget} current={current} deltas={deltas} objetivos={objetivos} />;
    case 'kpi-group':
      return <KPIGroupWidget widget={widget} current={current} deltas={deltas} />;
    case 'table':
      return <TableWidget widget={widget} storeId={storeId} from={from} to={to} />;
    case 'note':
      return <NoteWidget widget={widget} />;
    case 'separator':
      return <SeparatorWidget widget={widget} />;
    case 'metric-card':
      return <KPIWidget widget={widget} current={current} deltas={deltas} objetivos={objetivos} />;
    case 'mini-analysis':
      return <NoteWidget widget={widget} />;
    case 'line-chart':
      return <LineLikeChartWidget widget={widget} current={current} dailyMetrics={dailyMetrics} mode="line" />;
    case 'bar-chart':
      return <LineLikeChartWidget widget={widget} current={current} dailyMetrics={dailyMetrics} mode="bar" />;
    case 'area-chart':
      return <LineLikeChartWidget widget={widget} current={current} dailyMetrics={dailyMetrics} mode="area" />;
    case 'donut-chart':
      return <DonutChartWidget widget={widget} current={current} />;
    case 'funnel-chart':
      return <FunnelChartWidget widget={widget} current={current} />;
    case 'heatmap':
      return <HeatmapWidget widget={widget} dailyMetrics={dailyMetrics} />;
    case 'period-comparison':
      return <PeriodComparisonWidget widget={widget} dailyMetrics={dailyMetrics} previousDailyMetrics={previousDailyMetrics} />;
    default:
      return <div className="text-[11px] text-gray-600">Tipo desconocido: {widget.type}</div>;
  }
}
