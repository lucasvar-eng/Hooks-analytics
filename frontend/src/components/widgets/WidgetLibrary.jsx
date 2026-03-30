import { useState } from 'react';

const METRIC_CATALOG = [
  { section: 'Ventas', items: [
    { key: 'ordenesPositivas', label: 'Órdenes', prefix: '', suffix: '', decimals: 0 },
    { key: 'revenue', label: 'Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
    { key: 'netRevenue', label: 'Net Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
    { key: 'aov', label: 'AOV', prefix: '$', suffix: '', decimals: 0 },
    { key: 'aovNeto', label: 'AOV Neto', prefix: '$', suffix: '', decimals: 0 },
    { key: 'devoluciones', label: 'Devoluciones', prefix: '', suffix: '', decimals: 0 },
  ]},
  { section: 'Rentabilidad', items: [
    { key: 'profit', label: 'Profit', prefix: '$', suffix: '', decimals: 0, compact: true },
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
  ]},
  { section: 'Clientes', items: [
    { key: 'ncPct', label: 'NC %', prefix: '', suffix: '%', decimals: 1 },
    { key: 'ncOrdenes', label: 'NC Órdenes', prefix: '', suffix: '', decimals: 0 },
    { key: 'ncRevenue', label: 'NC Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
    { key: 'ncCpa', label: 'NC CPA', prefix: '$', suffix: '', decimals: 0 },
    { key: 'ncRoas', label: 'NC ROAS', prefix: '', suffix: 'x', decimals: 2 },
    { key: 'rcOrdenes', label: 'RC Órdenes', prefix: '', suffix: '', decimals: 0 },
    { key: 'rcRevenue', label: 'RC Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
  ]},
  { section: 'Costos', items: [
    { key: 'totalCostoProductos', label: 'COGS', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalCostoEnvio', label: 'Costo Envío', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalComisionPago', label: 'Comisión Pago', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalComisionCuotas', label: 'Comisión Cuotas', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalImpuestosIBB', label: 'IBB', prefix: '$', suffix: '', decimals: 0 },
    { key: 'totalFeePlataforma', label: 'Fee Plataforma', prefix: '$', suffix: '', decimals: 0 },
  ]},
];

const ALL_METRICS = METRIC_CATALOG.flatMap((g) => g.items);

const WIDGET_TYPES = [
  { type: 'kpi', label: 'KPI Card', description: 'Una métrica individual con valor, delta y target', icon: '📊' },
  { type: 'kpi-group', label: 'Grupo de KPIs', description: 'Varias métricas agrupadas en una tarjeta', icon: '📋' },
  { type: 'table', label: 'Tabla', description: 'Tabla de datos (ventas, campañas, etc.)', icon: '📑' },
  { type: 'note', label: 'Nota', description: 'Texto libre, observaciones o análisis', icon: '📝' },
  { type: 'separator', label: 'Separador', description: 'Título de sección para organizar', icon: '➖' },
];

const SIZE_OPTIONS = [
  { value: 'sm', label: '1 col', description: 'Pequeño' },
  { value: 'md', label: '2 col', description: 'Mediano' },
  { value: 'lg', label: '3 col', description: 'Grande' },
  { value: 'full', label: 'Ancho completo', description: 'Full' },
];

const TABLE_SOURCES = [
  { value: 'latest-sales', label: 'Últimas Ventas' },
];

export default function WidgetLibrary({ onAdd, onClose }) {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState(null);
  const [title, setTitle] = useState('');
  const [size, setSize] = useState('sm');

  const [selectedMetric, setSelectedMetric] = useState('');
  const [groupMetrics, setGroupMetrics] = useState([]);
  const [dataSource, setDataSource] = useState('latest-sales');
  const [noteText, setNoteText] = useState('');

  const handleSelectType = (type) => {
    setSelectedType(type);
    if (type === 'kpi') setSize('sm');
    else if (type === 'kpi-group') setSize('md');
    else if (type === 'table' || type === 'separator') setSize('full');
    else if (type === 'note') setSize('md');
    setStep(2);
  };

  const toggleGroupMetric = (metric) => {
    setGroupMetrics((prev) => {
      const exists = prev.find((m) => m.key === metric.key);
      if (exists) return prev.filter((m) => m.key !== metric.key);
      return [...prev, metric];
    });
  };

  const handleAdd = () => {
    if (!selectedType) return;

    const config = {};
    let finalTitle = title;

    if (selectedType === 'kpi') {
      const m = ALL_METRICS.find((o) => o.key === selectedMetric);
      if (!m) return;
      Object.assign(config, { metricKey: m.key, prefix: m.prefix, suffix: m.suffix, decimals: m.decimals, compact: m.compact });
      if (!finalTitle) finalTitle = m.label;
    }

    if (selectedType === 'kpi-group') {
      if (groupMetrics.length === 0) return;
      config.metrics = groupMetrics;
      if (!finalTitle) finalTitle = 'Grupo de métricas';
    }

    if (selectedType === 'table') {
      config.dataSource = dataSource;
      if (!finalTitle) finalTitle = TABLE_SOURCES.find((s) => s.value === dataSource)?.label || 'Tabla';
    }

    if (selectedType === 'note') {
      config.text = noteText;
      if (!finalTitle) finalTitle = 'Nota';
    }

    if (selectedType === 'separator') {
      if (!finalTitle) finalTitle = 'Sección';
    }

    onAdd({ type: selectedType, title: finalTitle, size, config });
    onClose();
  };

  const canAdd = () => {
    if (!selectedType) return false;
    if (selectedType === 'kpi' && !selectedMetric) return false;
    if (selectedType === 'kpi-group' && groupMetrics.length === 0) return false;
    return true;
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="kpi-label">
          {step === 1 ? 'Agregar Widget' : `Configurar ${WIDGET_TYPES.find((t) => t.type === selectedType)?.label}`}
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

      {/* Step 1: Choose type */}
      {step === 1 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {WIDGET_TYPES.map((wt) => (
            <button
              key={wt.type}
              onClick={() => handleSelectType(wt.type)}
              className="p-3 rounded-lg border border-white/[0.06] hover:border-blue-500/30 bg-white/[0.02] hover:bg-blue-500/[0.05] text-left transition"
            >
              <span className="text-lg">{wt.icon}</span>
              <p className="text-[11px] font-semibold text-white mt-1">{wt.label}</p>
              <p className="text-[9px] text-gray-600 mt-0.5">{wt.description}</p>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="kpi-label mb-1 block">Título</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-dark w-full"
              placeholder="Se auto-genera si lo dejás vacío"
            />
          </div>

          {/* Size */}
          {selectedType !== 'separator' && (
            <div>
              <label className="kpi-label mb-1 block">Tamaño</label>
              <div className="flex gap-1 mt-1">
                {SIZE_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSize(s.value)}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded transition ${
                      size === s.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/[0.05] text-gray-500 hover:text-gray-300 border border-white/[0.06]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* KPI: metric selector */}
          {selectedType === 'kpi' && (
            <div>
              <label className="kpi-label mb-1 block">Métrica</label>
              <div className="mt-1 max-h-48 overflow-y-auto space-y-2">
                {METRIC_CATALOG.map((group) => (
                  <div key={group.section}>
                    <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider mb-1">{group.section}</p>
                    <div className="flex flex-wrap gap-1">
                      {group.items.map((m) => (
                        <button
                          key={m.key}
                          onClick={() => setSelectedMetric(m.key)}
                          className={`px-2 py-1 text-[10px] font-medium rounded transition ${
                            selectedMetric === m.key
                              ? 'bg-blue-500 text-white'
                              : 'bg-white/[0.05] text-gray-400 hover:text-gray-200 border border-white/[0.06]'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KPI-group: multi metric selector */}
          {selectedType === 'kpi-group' && (
            <div>
              <label className="kpi-label mb-1 block">
                Métricas ({groupMetrics.length} seleccionadas)
              </label>
              <div className="mt-1 max-h-48 overflow-y-auto space-y-2">
                {METRIC_CATALOG.map((group) => (
                  <div key={group.section}>
                    <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider mb-1">{group.section}</p>
                    <div className="flex flex-wrap gap-1">
                      {group.items.map((m) => {
                        const selected = groupMetrics.some((gm) => gm.key === m.key);
                        return (
                          <button
                            key={m.key}
                            onClick={() => toggleGroupMetric(m)}
                            className={`px-2 py-1 text-[10px] font-medium rounded transition ${
                              selected
                                ? 'bg-blue-500 text-white'
                                : 'bg-white/[0.05] text-gray-400 hover:text-gray-200 border border-white/[0.06]'
                            }`}
                          >
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table: data source */}
          {selectedType === 'table' && (
            <div>
              <label className="kpi-label mb-1 block">Fuente de datos</label>
              <select
                value={dataSource}
                onChange={(e) => setDataSource(e.target.value)}
                className="input-dark w-full"
              >
                {TABLE_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Note: text */}
          {selectedType === 'note' && (
            <div>
              <label className="kpi-label mb-1 block">Contenido</label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                className="input-dark w-full resize-none"
                placeholder="Escribí notas, observaciones, análisis..."
              />
            </div>
          )}

          <button
            onClick={handleAdd}
            disabled={!canAdd()}
            className="btn-primary w-full disabled:opacity-40"
          >
            Agregar widget
          </button>
        </div>
      )}
    </div>
  );
}
