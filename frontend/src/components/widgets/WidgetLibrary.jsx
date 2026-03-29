import { useState } from 'react';

const METRIC_OPTIONS = [
  { key: 'ordenesPositivas', label: 'Órdenes', prefix: '', suffix: '', decimals: 0 },
  { key: 'revenue', label: 'Revenue', prefix: '$', suffix: '', decimals: 0 },
  { key: 'netRevenue', label: 'Net Revenue', prefix: '$', suffix: '', decimals: 0 },
  { key: 'profit', label: 'Profit', prefix: '$', suffix: '', decimals: 0 },
  { key: 'profitMargin', label: 'Margen %', prefix: '', suffix: '%', decimals: 1 },
  { key: 'adSpend', label: 'Ad Spend', prefix: '$', suffix: '', decimals: 0 },
  { key: 'roas', label: 'ROAS', prefix: '', suffix: 'x', decimals: 2 },
  { key: 'trueRoas', label: 'True ROAS', prefix: '', suffix: 'x', decimals: 2 },
  { key: 'cpa', label: 'CPA', prefix: '$', suffix: '', decimals: 0 },
  { key: 'ncPct', label: 'NC %', prefix: '', suffix: '%', decimals: 1 },
  { key: 'aov', label: 'AOV', prefix: '$', suffix: '', decimals: 0 },
  { key: 'ctr', label: 'CTR', prefix: '', suffix: '%', decimals: 2 },
];

const WIDGET_TYPES = [
  {
    type: 'metric-card',
    label: 'KPI Card',
    description: 'Muestra una métrica con su valor actual',
    needsMetric: true,
  },
  {
    type: 'mini-analysis',
    label: 'Nota / Análisis',
    description: 'Texto libre o análisis guardado',
    needsText: true,
  },
];

export default function WidgetLibrary({ onAdd, onClose }) {
  const [selectedType, setSelectedType] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customText, setCustomText] = useState('');

  const handleAdd = () => {
    if (!selectedType) return;

    const wt = WIDGET_TYPES.find((t) => t.type === selectedType);
    const config = {};
    let title = customTitle;

    if (wt.needsMetric && selectedMetric) {
      const m = METRIC_OPTIONS.find((o) => o.key === selectedMetric);
      config.metricKey = selectedMetric;
      config.prefix = m?.prefix;
      config.suffix = m?.suffix;
      config.decimals = m?.decimals;
      if (!title) title = m?.label || selectedMetric;
    }

    if (wt.needsText) {
      config.text = customText;
      if (!title) title = 'Nota';
    }

    if (!title) title = wt.label;

    onAdd({ type: selectedType, title, config });
    onClose();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase">Agregar Widget</h3>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
      </div>

      {/* Type selection */}
      <div className="space-y-2 mb-4">
        {WIDGET_TYPES.map((wt) => (
          <label
            key={wt.type}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
              selectedType === wt.type
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <input
              type="radio"
              name="widgetType"
              value={wt.type}
              checked={selectedType === wt.type}
              onChange={() => setSelectedType(wt.type)}
              className="mt-0.5 accent-indigo-600"
            />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{wt.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{wt.description}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Metric selector for metric-card */}
      {selectedType === 'metric-card' && (
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Métrica</label>
          <select
            value={selectedMetric || ''}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="">Seleccionar...</option>
            {METRIC_OPTIONS.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Text for mini-analysis */}
      {selectedType === 'mini-analysis' && (
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Contenido</label>
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="Texto o insights..."
          />
        </div>
      )}

      {/* Custom title */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Título (opcional)</label>
        <input
          type="text"
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          placeholder="Se auto-genera si lo dejás vacío"
        />
      </div>

      <button
        onClick={handleAdd}
        disabled={!selectedType || (selectedType === 'metric-card' && !selectedMetric)}
        className="w-full px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50 transition font-medium"
      >
        Agregar
      </button>
    </div>
  );
}
