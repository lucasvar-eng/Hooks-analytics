import { useState } from 'react';
import LatestSalesTable from '../dashboard/LatestSalesTable';

function formatValue(value, prefix = '', suffix = '', decimals = 0, compact = false) {
  if (value == null || isNaN(value)) return '—';
  let num = Number(value);
  let formatted;
  if (compact && Math.abs(num) >= 1000000) formatted = (num / 1000000).toFixed(1) + 'M';
  else if (compact && Math.abs(num) >= 1000) formatted = (num / 1000).toFixed(1) + 'K';
  else formatted = num.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${prefix}${formatted}${suffix}`;
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
  return (
    <p className="section-label">{widget.title}</p>
  );
}

export default function WidgetRenderer({ widget, current, deltas, objetivos, storeId, from, to }) {
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
    default:
      return <div className="text-[11px] text-gray-600">Tipo desconocido: {widget.type}</div>;
  }
}
