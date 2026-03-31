import { useMemo, useState } from 'react';

export const METRIC_CATALOG = [
  { section: 'Ventas', items: [
    { key: 'ordenesPositivas', label: 'Órdenes', prefix: '', suffix: '', decimals: 0 },
    { key: 'revenue', label: 'Ingresos', prefix: '$', suffix: '', decimals: 0, compact: true },
    { key: 'netRevenue', label: 'Ingresos netos', prefix: '$', suffix: '', decimals: 0, compact: true },
    { key: 'aov', label: 'Ticket promedio', prefix: '$', suffix: '', decimals: 0 },
    { key: 'aovNeto', label: 'Ticket neto', prefix: '$', suffix: '', decimals: 0 },
    { key: 'devoluciones', label: 'Devoluciones', prefix: '', suffix: '', decimals: 0 },
  ]},
  { section: 'Rentabilidad', items: [
    { key: 'profit', label: 'Ganancia', prefix: '$', suffix: '', decimals: 0, compact: true },
    { key: 'profitMargin', label: 'Margen %', prefix: '', suffix: '%', decimals: 1 },
  ]},
  { section: 'Marketing', items: [
    { key: 'adSpend', label: 'Ad Spend', prefix: '$', suffix: '', decimals: 0, compact: true },
    { key: 'roas', label: 'ROAS', prefix: '', suffix: 'x', decimals: 2 },
    { key: 'trueRoas', label: 'True ROAS', prefix: '', suffix: 'x', decimals: 2 },
    { key: 'cpa', label: 'CPA', prefix: '$', suffix: '', decimals: 0 },
    { key: 'trueCpa', label: 'True CPA', prefix: '$', suffix: '', decimals: 0 },
    { key: 'ctr', label: 'CTR', prefix: '', suffix: '%', decimals: 2 },
    { key: 'cpm', label: 'CPM', prefix: '$', suffix: '', decimals: 0 },
    { key: 'conversionRate', label: 'CVR', prefix: '', suffix: '%', decimals: 2 },
    { key: 'impressions', label: 'Impresiones', prefix: '', suffix: '', decimals: 0, compact: true },
    { key: 'linkClicks', label: 'Link Clicks', prefix: '', suffix: '', decimals: 0, compact: true },
    { key: 'landingPageViews', label: 'Landing Views', prefix: '', suffix: '', decimals: 0, compact: true },
    { key: 'addToCart', label: 'Add To Cart', prefix: '', suffix: '', decimals: 0, compact: true },
    { key: 'initiatedCheckout', label: 'Checkout', prefix: '', suffix: '', decimals: 0, compact: true },
    { key: 'metaPurchases', label: 'Compras Meta', prefix: '', suffix: '', decimals: 0, compact: true },
  ]},
  { section: 'Clientes', items: [
    { key: 'ncPct', label: 'NC %', prefix: '', suffix: '%', decimals: 1 },
    { key: 'ncOrdenes', label: 'NC Órdenes', prefix: '', suffix: '', decimals: 0 },
    { key: 'ncRevenue', label: 'Ingresos NC', prefix: '$', suffix: '', decimals: 0, compact: true },
    { key: 'ncCpa', label: 'NC CPA', prefix: '$', suffix: '', decimals: 0 },
    { key: 'ncRoas', label: 'NC ROAS', prefix: '', suffix: 'x', decimals: 2 },
    { key: 'rcOrdenes', label: 'RC Órdenes', prefix: '', suffix: '', decimals: 0 },
    { key: 'rcRevenue', label: 'Ingresos RC', prefix: '$', suffix: '', decimals: 0, compact: true },
  ]},
  { section: 'Costos', items: [
    { key: 'totalCostoProductos', label: 'Costo de productos', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalCostoEnvio', label: 'Costo Envío', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalComisionPago', label: 'Comisión Pago', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalComisionCuotas', label: 'Comisión Cuotas', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalImpuestosIBB', label: 'IBB', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalFeePlataforma', label: 'Cargo de plataforma', prefix: '$', suffix: '', decimals: 0 },
  ]},
];

export const ALL_METRICS = METRIC_CATALOG.flatMap((group) => group.items);

export const WIDGET_TYPES = [
  { type: 'kpi', label: 'KPI Card', description: 'Una métrica individual con valor, delta y target', icon: '📊' },
  { type: 'kpi-group', label: 'Grupo de KPIs', description: 'Varias métricas agrupadas en una tarjeta', icon: '📋' },
  { type: 'table', label: 'Tabla', description: 'Tabla de datos operativos', icon: '📑' },
  { type: 'note', label: 'Nota', description: 'Texto libre, observaciones o análisis', icon: '📝' },
  { type: 'separator', label: 'Separador', description: 'Título de sección para organizar', icon: '➖' },
  { type: 'line-chart', label: 'Gráfico de líneas', description: 'Evolución diaria de una métrica', icon: '📈' },
  { type: 'bar-chart', label: 'Barras', description: 'Serie diaria comparada por barras', icon: '📊' },
  { type: 'area-chart', label: 'Área', description: 'Tendencia diaria con volumen', icon: '🟦' },
  { type: 'donut-chart', label: 'Donut', description: 'Distribución del período actual', icon: '🍩' },
  { type: 'funnel-chart', label: 'Funnel visual', description: 'Embudo de conversión', icon: '🔻' },
  { type: 'heatmap', label: 'Heatmap', description: 'Mapa diario por intensidad', icon: '🗓️' },
  { type: 'period-comparison', label: 'Comparación de períodos', description: 'Actual vs período anterior', icon: '🆚' },
];

export const SIZE_OPTIONS = [
  { value: 'sm', label: '1 col' },
  { value: 'md', label: '2 col' },
  { value: 'lg', label: '3 col' },
  { value: 'full', label: 'Ancho completo' },
];

export const TABLE_SOURCES = [
  { value: 'latest-sales', label: 'Últimas Ventas' },
];

export const FUNNEL_PRESETS = [
  { value: 'meta', label: 'Meta completo' },
  { value: 'commerce', label: 'Click a compra' },
];

function MetricSelector({ selected, onSelect, multi = false, limit = 6 }) {
  return (
    <div className="mt-1 max-h-56 overflow-y-auto space-y-2">
      {METRIC_CATALOG.map((group) => (
        <div key={group.section}>
          <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider mb-1">{group.section}</p>
          <div className="flex flex-wrap gap-1">
            {group.items.map((metric) => {
              const isSelected = multi
                ? selected.some((item) => item.key === metric.key)
                : selected === metric.key;

              return (
                <button
                  key={metric.key}
                  type="button"
                  onClick={() => onSelect(metric)}
                  disabled={multi && !isSelected && selected.length >= limit}
                  className={`px-2 py-1 text-[10px] font-medium rounded transition ${
                    isSelected
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/[0.05] text-gray-400 hover:text-gray-200 border border-white/[0.06] disabled:opacity-40'
                  }`}
                >
                  {metric.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WidgetLibrary({ onAdd, onClose }) {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState(null);
  const [title, setTitle] = useState('');
  const [size, setSize] = useState('sm');

  const [selectedMetric, setSelectedMetric] = useState('');
  const [groupMetrics, setGroupMetrics] = useState([]);
  const [chartMetrics, setChartMetrics] = useState([]);
  const [dataSource, setDataSource] = useState('latest-sales');
  const [noteText, setNoteText] = useState('');
  const [funnelPreset, setFunnelPreset] = useState('meta');

  const selectedMetricMeta = useMemo(
    () => ALL_METRICS.find((item) => item.key === selectedMetric),
    [selectedMetric]
  );

  const handleSelectType = (type) => {
    setSelectedType(type);
    if (type === 'kpi') setSize('sm');
    else if (type === 'kpi-group' || type === 'donut-chart' || type === 'funnel-chart') setSize('md');
    else if (type === 'table' || type === 'separator' || type === 'heatmap') setSize('full');
    else if (type === 'note') setSize('md');
    else setSize('lg');
    setStep(2);
  };

  const toggleGroupMetric = (metric) => {
    setGroupMetrics((prev) => {
      const exists = prev.find((item) => item.key === metric.key);
      if (exists) return prev.filter((item) => item.key !== metric.key);
      return [...prev, metric];
    });
  };

  const toggleChartMetric = (metric) => {
    setChartMetrics((prev) => {
      const exists = prev.find((item) => item.key === metric.key);
      if (exists) return prev.filter((item) => item.key !== metric.key);
      return [...prev, metric];
    });
  };

  const handleAdd = () => {
    if (!selectedType) return;

    const config = {};
    let finalTitle = title;

    if (selectedType === 'kpi') {
      const metric = ALL_METRICS.find((item) => item.key === selectedMetric);
      if (!metric) return;
      Object.assign(config, {
        metricKey: metric.key,
        metricLabel: metric.label,
        prefix: metric.prefix,
        suffix: metric.suffix,
        decimals: metric.decimals,
        compact: metric.compact,
      });
      if (!finalTitle) finalTitle = metric.label;
    }

    if (selectedType === 'kpi-group') {
      if (!groupMetrics.length) return;
      config.metrics = groupMetrics;
      if (!finalTitle) finalTitle = 'Grupo de métricas';
    }

    if (['line-chart', 'bar-chart', 'area-chart', 'heatmap', 'period-comparison'].includes(selectedType)) {
      const metric = ALL_METRICS.find((item) => item.key === selectedMetric);
      if (!metric) return;
      Object.assign(config, {
        metricKey: metric.key,
        metricLabel: metric.label,
        prefix: metric.prefix,
        suffix: metric.suffix,
        decimals: metric.decimals,
        compact: metric.compact,
      });
      if (!finalTitle) finalTitle = `${WIDGET_TYPES.find((item) => item.type === selectedType)?.label} · ${metric.label}`;
    }

    if (selectedType === 'donut-chart') {
      if (!chartMetrics.length) return;
      config.metrics = chartMetrics;
      if (!finalTitle) finalTitle = 'Distribución del período';
    }

    if (selectedType === 'funnel-chart') {
      config.funnelPreset = funnelPreset;
      if (!finalTitle) {
        finalTitle = funnelPreset === 'meta' ? 'Funnel de Meta Ads' : 'Funnel de compra';
      }
    }

    if (selectedType === 'table') {
      config.dataSource = dataSource;
      if (!finalTitle) finalTitle = TABLE_SOURCES.find((source) => source.value === dataSource)?.label || 'Tabla';
    }

    if (selectedType === 'note') {
      config.text = noteText;
      if (!finalTitle) finalTitle = 'Nota';
    }

    if (selectedType === 'separator' && !finalTitle) {
      finalTitle = 'Sección';
    }

    onAdd({ type: selectedType, title: finalTitle, size, config });
    onClose();
  };

  const canAdd = () => {
    if (!selectedType) return false;
    if (selectedType === 'kpi' && !selectedMetric) return false;
    if (selectedType === 'kpi-group' && !groupMetrics.length) return false;
    if (['line-chart', 'bar-chart', 'area-chart', 'heatmap', 'period-comparison'].includes(selectedType) && !selectedMetric) return false;
    if (selectedType === 'donut-chart' && !chartMetrics.length) return false;
    return true;
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="kpi-label">
          {step === 1 ? 'Agregar Widget' : `Configurar ${WIDGET_TYPES.find((item) => item.type === selectedType)?.label}`}
        </h3>
        <div className="flex gap-2">
          {step === 2 && (
            <button onClick={() => setStep(1)} className="text-[10px] text-gray-500 hover:text-blue-400 transition">
              ← Volver
            </button>
          )}
          <button onClick={onClose} className="text-[10px] text-gray-500 hover:text-gray-300 transition">Cancelar</button>
        </div>
      </div>

      {step === 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {WIDGET_TYPES.map((widgetType) => (
            <button
              key={widgetType.type}
              onClick={() => handleSelectType(widgetType.type)}
              className="p-3 rounded-lg border border-white/[0.06] hover:border-blue-500/30 bg-white/[0.02] hover:bg-blue-500/[0.05] text-left transition"
            >
              <span className="text-lg">{widgetType.icon}</span>
              <p className="text-[11px] font-semibold text-white mt-1">{widgetType.label}</p>
              <p className="text-[9px] text-gray-600 mt-0.5">{widgetType.description}</p>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="kpi-label mb-1 block">Título</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="input-dark w-full"
              placeholder="Se auto-genera si lo dejás vacío"
            />
          </div>

          {selectedType !== 'separator' && (
            <div>
              <label className="kpi-label mb-1 block">Tamaño</label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {SIZE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSize(option.value)}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded transition ${
                      size === option.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/[0.05] text-gray-500 hover:text-gray-300 border border-white/[0.06]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedType === 'kpi' && (
            <div>
              <label className="kpi-label mb-1 block">Métrica</label>
              <MetricSelector selected={selectedMetric} onSelect={(metric) => setSelectedMetric(metric.key)} />
            </div>
          )}

          {selectedType === 'kpi-group' && (
            <div>
              <label className="kpi-label mb-1 block">Métricas ({groupMetrics.length} seleccionadas)</label>
              <MetricSelector selected={groupMetrics} onSelect={toggleGroupMetric} multi limit={8} />
            </div>
          )}

          {['line-chart', 'bar-chart', 'area-chart', 'heatmap', 'period-comparison'].includes(selectedType) && (
            <div>
              <label className="kpi-label mb-1 block">Métrica de la serie</label>
              <MetricSelector selected={selectedMetric} onSelect={(metric) => setSelectedMetric(metric.key)} />
              {selectedMetricMeta ? (
                <p className="text-[10px] text-gray-500 mt-2">
                  Se va a renderizar con la serie diaria de <span className="text-gray-300">{selectedMetricMeta.label}</span>.
                </p>
              ) : null}
            </div>
          )}

          {selectedType === 'donut-chart' && (
            <div>
              <label className="kpi-label mb-1 block">Métricas a distribuir ({chartMetrics.length}/6)</label>
              <MetricSelector selected={chartMetrics} onSelect={toggleChartMetric} multi limit={6} />
            </div>
          )}

          {selectedType === 'funnel-chart' && (
            <div>
              <label className="kpi-label mb-1 block">Preset de funnel</label>
              <div className="flex gap-1 mt-1">
                {FUNNEL_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => setFunnelPreset(preset.value)}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded transition ${
                      funnelPreset === preset.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/[0.05] text-gray-500 hover:text-gray-300 border border-white/[0.06]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedType === 'table' && (
            <div>
              <label className="kpi-label mb-1 block">Fuente</label>
              <select value={dataSource} onChange={(event) => setDataSource(event.target.value)} className="input-dark w-full">
                {TABLE_SOURCES.map((source) => (
                  <option key={source.value} value={source.value}>{source.label}</option>
                ))}
              </select>
            </div>
          )}

          {selectedType === 'note' && (
            <div>
              <label className="kpi-label mb-1 block">Contenido</label>
              <textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                rows={5}
                className="input-dark w-full"
                placeholder="Escribí una nota o contexto para el dashboard"
              />
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleAdd}
              disabled={!canAdd()}
              className="btn-primary text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Agregar widget
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
