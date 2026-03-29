/**
 * Renders a single widget based on its type.
 */
export default function WidgetRenderer({ widget, metrics }) {
  const current = metrics?.current || {};

  switch (widget.type) {
    case 'metric-card':
      return <MetricCardWidget widget={widget} value={current[widget.config?.metricKey]} />;
    case 'chart':
      return <ChartPlaceholder widget={widget} />;
    case 'table':
      return <TablePlaceholder widget={widget} />;
    case 'mini-analysis':
      return <MiniAnalysisWidget widget={widget} />;
    default:
      return <div className="text-xs text-gray-400">Tipo desconocido: {widget.type}</div>;
  }
}

function MetricCardWidget({ widget, value }) {
  const fmt = (v) => {
    if (v == null) return '—';
    const cfg = widget.config || {};
    const num = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(num)) return '—';
    const formatted = cfg.decimals != null ? num.toFixed(cfg.decimals) : Math.round(num);
    return `${cfg.prefix || ''}${Number(formatted).toLocaleString('es-AR')}${cfg.suffix || ''}`;
  };

  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{widget.title}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fmt(value)}</p>
    </div>
  );
}

function ChartPlaceholder({ widget }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{widget.title}</p>
      <div className="h-24 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center text-xs text-gray-400">
        Chart: {widget.config?.chartType || 'bar'}
      </div>
    </div>
  );
}

function TablePlaceholder({ widget }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{widget.title}</p>
      <div className="h-16 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center text-xs text-gray-400">
        Tabla: {widget.config?.dataSource || 'orders'}
      </div>
    </div>
  );
}

function MiniAnalysisWidget({ widget }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{widget.title}</p>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        {widget.config?.text || 'Sin contenido de análisis.'}
      </p>
    </div>
  );
}
