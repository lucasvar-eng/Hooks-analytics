import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import WidgetRenderer from './WidgetRenderer';
import WidgetLibrary, { ALL_METRICS, FUNNEL_PRESETS, METRIC_CATALOG, SIZE_OPTIONS, TABLE_SOURCES } from './WidgetLibrary';

const SIZE_CLASSES = {
  sm: 'col-span-1',
  md: 'col-span-1 sm:col-span-2',
  lg: 'col-span-1 sm:col-span-2 lg:col-span-3',
  full: 'col-span-1 sm:col-span-2 lg:col-span-4',
};

export default function WidgetGrid({ storeId, pageId = 'dashboard', metrics, objetivos, from, to }) {
  const [widgets, setWidgets] = useState([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [dailyMetrics, setDailyMetrics] = useState([]);
  const [previousDailyMetrics, setPreviousDailyMetrics] = useState([]);

  const current = metrics?.current || {};
  const deltas = metrics?.deltas || {};

  const fetchWidgets = useCallback(async () => {
    try {
      let { data } = await api.get(`/api/stores/${storeId}/widgets`, { params: { pageId } });

      if (data.length === 0) {
        const seedRes = await api.post(`/api/stores/${storeId}/widgets/seed`, { pageId });
        data = seedRes.data;
      }

      setWidgets(Array.isArray(data) ? data : []);
    } catch {
      setWidgets([]);
    }
    setLoading(false);
  }, [storeId, pageId]);

  useEffect(() => { fetchWidgets(); }, [fetchWidgets]);

  useEffect(() => {
    let cancelled = false;

    async function fetchDailyMetrics() {
      try {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        const durationMs = toDate.getTime() - fromDate.getTime();
        const prevTo = new Date(fromDate.getTime() - 1);
        const prevFrom = new Date(prevTo.getTime() - durationMs);

        const [currentRes, previousRes] = await Promise.all([
          api.get(`/api/stores/${storeId}/daily-metrics`, { params: { from, to } }),
          api.get(`/api/stores/${storeId}/daily-metrics`, {
            params: {
              from: prevFrom.toISOString(),
              to: prevTo.toISOString(),
            },
          }),
        ]);

        if (!cancelled) {
          setDailyMetrics(Array.isArray(currentRes.data) ? currentRes.data : []);
          setPreviousDailyMetrics(Array.isArray(previousRes.data) ? previousRes.data : []);
        }
      } catch {
        if (!cancelled) {
          setDailyMetrics([]);
          setPreviousDailyMetrics([]);
        }
      }
    }

    if (storeId && from && to) {
      fetchDailyMetrics();
    }

    return () => {
      cancelled = true;
    };
  }, [storeId, from, to]);

  const handleAdd = async (widgetData) => {
    try {
      await api.post(`/api/stores/${storeId}/widgets`, { ...widgetData, pageId });
      fetchWidgets();
    } catch {}
  };

  const handleRemove = async (widgetId) => {
    try {
      await api.delete(`/api/stores/${storeId}/widgets/${widgetId}`);
      setWidgets((prev) => prev.filter((w) => w._id !== widgetId));
    } catch {}
  };

  const handleMove = async (index, direction) => {
    const swapIdx = index + direction;
    if (swapIdx < 0 || swapIdx >= widgets.length) return;

    const updated = [...widgets];
    [updated[index], updated[swapIdx]] = [updated[swapIdx], updated[index]];
    const reordered = updated.map((w, i) => ({ ...w, order: i }));
    setWidgets(reordered);

    try {
      await api.put(`/api/stores/${storeId}/widgets/reorder`, {
        items: reordered.map((w) => ({ _id: w._id, order: w.order })),
      });
    } catch {}
  };

  const handleReset = async () => {
    if (!confirm('¿Resetear el dashboard a la configuración por defecto? Se perderán todos los cambios.')) return;
    try {
      const { data } = await api.post(`/api/stores/${storeId}/widgets/reset`, { pageId });
      setWidgets(data);
      setEditMode(false);
    } catch {}
  };

  const handleUpdateWidget = async (widgetId, payload) => {
    try {
      const { data } = await api.put(`/api/stores/${storeId}/widgets/${widgetId}`, payload);
      setWidgets((prev) => prev.map((item) => (item._id === widgetId ? data : item)));
      setEditingWidget(null);
    } catch {}
  };

  if (loading) {
    return <div className="text-center py-12 text-[12px] text-gray-600">Cargando dashboard...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`px-2.5 py-1 text-[10px] font-semibold rounded transition ${
              editMode
                ? 'bg-blue-500 text-white'
                : 'bg-white/[0.05] text-gray-500 hover:text-gray-300 border border-white/[0.06]'
            }`}
          >
            {editMode ? '✓ Listo' : '✎ Editar dashboard'}
          </button>
          {editMode && (
            <>
              <button
                onClick={() => setShowLibrary(!showLibrary)}
                className="btn-primary text-[10px]"
              >
                + Agregar widget
              </button>
              <button
                onClick={handleReset}
                className="px-2.5 py-1 text-[10px] font-semibold rounded bg-white/[0.05] border border-white/[0.06] text-gray-500 hover:text-red-400 transition"
              >
                ↻ Reset
              </button>
            </>
          )}
        </div>
        <span className="text-[9px] text-gray-600">{widgets.length} widgets</span>
      </div>

      {/* Library panel */}
      {showLibrary && editMode && (
        <WidgetLibrary onAdd={handleAdd} onClose={() => setShowLibrary(false)} />
      )}

      {/* Widget grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {widgets.map((widget, idx) => {
          const isSeparator = widget.type === 'separator';
          const sizeClass = SIZE_CLASSES[widget.size] || SIZE_CLASSES.sm;
          const isTable = widget.type === 'table';

          if (isSeparator) {
            return (
              <div
                key={widget._id}
                className={`${SIZE_CLASSES.full} widget-surface ${editMode ? 'relative group' : ''}`}
                style={getWidgetStyleVars(widget)}
              >
                <WidgetRenderer widget={widget} current={current} deltas={deltas} objetivos={objetivos} storeId={storeId} from={from} to={to} dailyMetrics={dailyMetrics} previousDailyMetrics={previousDailyMetrics} />
                {editMode && <WidgetControls idx={idx} total={widgets.length} onMove={handleMove} onRemove={() => handleRemove(widget._id)} onEdit={() => setEditingWidget(widget)} />}
              </div>
            );
          }

          return (
            <div
              key={widget._id}
              className={`${sizeClass} card widget-surface ${isTable ? '' : 'p-3.5'} ${editMode ? 'relative group ring-1 ring-transparent hover:ring-blue-500/30' : ''} transition`}
              style={getWidgetStyleVars(widget)}
            >
              <WidgetRenderer widget={widget} current={current} deltas={deltas} objetivos={objetivos} storeId={storeId} from={from} to={to} dailyMetrics={dailyMetrics} previousDailyMetrics={previousDailyMetrics} />
              {editMode && <WidgetControls idx={idx} total={widgets.length} onMove={handleMove} onRemove={() => handleRemove(widget._id)} onEdit={() => setEditingWidget(widget)} />}
            </div>
          );
        })}
      </div>

      {editingWidget && (
        <WidgetEditorModal
          widget={editingWidget}
          onClose={() => setEditingWidget(null)}
          onSave={(payload) => handleUpdateWidget(editingWidget._id, payload)}
        />
      )}
    </div>
  );
}

function getWidgetStyleVars(widget) {
  const style = widget.config?.style || {};
  return {
    '--widget-bg': style.backgroundColor || 'var(--bg-card)',
    '--widget-text': style.textColor || 'var(--text-primary)',
    '--widget-muted': style.mutedColor || 'var(--text-secondary)',
    '--widget-border': style.borderColor || 'var(--border-subtle)',
  };
}

function WidgetControls({ idx, total, onMove, onRemove, onEdit }) {
  return (
    <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition bg-black/80 rounded px-1 py-0.5">
      <button
        onClick={onEdit}
        className="p-0.5 text-gray-400 hover:text-blue-400 transition"
        title="Editar"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      <button
        onClick={() => onMove(idx, -1)}
        disabled={idx === 0}
        className="p-0.5 text-gray-400 hover:text-white disabled:opacity-30 transition"
        title="Mover antes"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={() => onMove(idx, 1)}
        disabled={idx === total - 1}
        className="p-0.5 text-gray-400 hover:text-white disabled:opacity-30 transition"
        title="Mover después"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <button
        onClick={onRemove}
        className="p-0.5 text-gray-400 hover:text-red-400 transition"
        title="Eliminar"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function MetricChipPicker({ selectedKeys, onToggle, multi = false }) {
  return (
    <div className="space-y-2 max-h-52 overflow-y-auto">
      {METRIC_CATALOG.map((group) => (
        <div key={group.section}>
          <p className="kpi-label mb-1">{group.section}</p>
          <div className="flex flex-wrap gap-1">
            {group.items.map((metric) => {
              const selected = multi ? selectedKeys.includes(metric.key) : selectedKeys === metric.key;
              return (
                <button
                  key={metric.key}
                  type="button"
                  onClick={() => onToggle(metric)}
                  className={`px-2 py-1 text-[10px] rounded border transition ${
                    selected
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white/[0.03] text-gray-400 border-white/[0.06] hover:text-white'
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

function WidgetEditorModal({ widget, onClose, onSave }) {
  const [title, setTitle] = useState(widget.title || '');
  const [size, setSize] = useState(widget.size || 'sm');
  const [backgroundColor, setBackgroundColor] = useState(widget.config?.style?.backgroundColor || '#161616');
  const [textColor, setTextColor] = useState(widget.config?.style?.textColor || '#f5f5f5');
  const [borderColor, setBorderColor] = useState(widget.config?.style?.borderColor || '#2a2a2a');
  const [mutedColor, setMutedColor] = useState(widget.config?.style?.mutedColor || '#9ca3af');
  const [noteText, setNoteText] = useState(widget.config?.text || '');
  const [dataSource, setDataSource] = useState(widget.config?.dataSource || 'latest-sales');
  const [funnelPreset, setFunnelPreset] = useState(widget.config?.funnelPreset || 'meta');
  const [metricKey, setMetricKey] = useState(widget.config?.metricKey || '');
  const [metricKeys, setMetricKeys] = useState((widget.config?.metrics || []).map((item) => item.key));

  const isSeriesWidget = ['kpi', 'line-chart', 'bar-chart', 'area-chart', 'heatmap', 'period-comparison'].includes(widget.type);
  const isMetricGroupWidget = ['kpi-group', 'donut-chart'].includes(widget.type);

  const toggleMetric = (metric) => {
    if (isSeriesWidget) {
      setMetricKey(metric.key);
      return;
    }

    setMetricKeys((prev) =>
      prev.includes(metric.key)
        ? prev.filter((item) => item !== metric.key)
        : [...prev, metric.key]
    );
  };

  const handleSave = () => {
    const nextConfig = { ...(widget.config || {}) };

    if (isSeriesWidget) {
      const metric = ALL_METRICS.find((item) => item.key === metricKey);
      if (metric) {
        nextConfig.metricKey = metric.key;
        nextConfig.metricLabel = metric.label;
        nextConfig.prefix = metric.prefix;
        nextConfig.suffix = metric.suffix;
        nextConfig.decimals = metric.decimals;
        nextConfig.compact = metric.compact;
      }
    }

    if (isMetricGroupWidget) {
      nextConfig.metrics = ALL_METRICS.filter((item) => metricKeys.includes(item.key));
    }

    if (widget.type === 'note') {
      nextConfig.text = noteText;
    }

    if (widget.type === 'table') {
      nextConfig.dataSource = dataSource;
    }

    if (widget.type === 'funnel-chart') {
      nextConfig.funnelPreset = funnelPreset;
    }

    nextConfig.style = {
      backgroundColor,
      textColor,
      borderColor,
      mutedColor,
    };

    onSave({
      title,
      size,
      config: nextConfig,
    });
  };

  const ColorField = ({ label, value, onChange, placeholder }) => (
    <label className="block">
      <span className="text-[11px] text-app-secondary">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded-lg border border-white/[0.08] bg-transparent p-1 cursor-pointer"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-dark w-full"
          placeholder={placeholder}
        />
      </div>
    </label>
  );

  return (
    <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4">
      <div className="card w-full max-w-3xl p-4 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="kpi-label">Editar widget</p>
            <p className="text-[12px] text-app-secondary mt-1">
              Acá podés cambiar nombre, tamaño, contenido visible y colores. La ubicación se sigue ajustando con las flechas del dashboard.
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost text-[11px]">Cerrar</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="kpi-label mb-1 block">Nombre</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-dark w-full" />
          </div>
          <div>
            <label className="kpi-label mb-1 block">Tamaño</label>
            <select value={size} onChange={(e) => setSize(e.target.value)} className="input-dark w-full">
              {SIZE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        {isSeriesWidget && (
          <div className="mt-4">
            <label className="kpi-label mb-2 block">Información a mostrar</label>
            <MetricChipPicker selectedKeys={metricKey} onToggle={toggleMetric} />
          </div>
        )}

        {isMetricGroupWidget && (
          <div className="mt-4">
            <label className="kpi-label mb-2 block">Métricas visibles</label>
            <MetricChipPicker selectedKeys={metricKeys} onToggle={toggleMetric} multi />
          </div>
        )}

        {widget.type === 'table' && (
          <div className="mt-4">
            <label className="kpi-label mb-1 block">Tabla a mostrar</label>
            <select value={dataSource} onChange={(e) => setDataSource(e.target.value)} className="input-dark w-full">
              {TABLE_SOURCES.map((source) => (
                <option key={source.value} value={source.value}>{source.label}</option>
              ))}
            </select>
          </div>
        )}

        {widget.type === 'funnel-chart' && (
          <div className="mt-4">
            <label className="kpi-label mb-1 block">Preset del funnel</label>
            <select value={funnelPreset} onChange={(e) => setFunnelPreset(e.target.value)} className="input-dark w-full">
              {FUNNEL_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>{preset.label}</option>
              ))}
            </select>
          </div>
        )}

        {widget.type === 'note' && (
          <div className="mt-4">
            <label className="kpi-label mb-1 block">Contenido</label>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={5} className="input-dark w-full" />
          </div>
        )}

        <div className="mt-4">
          <p className="kpi-label mb-2">Estilo de la tarjeta</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ColorField label="Fondo" value={backgroundColor} onChange={setBackgroundColor} placeholder="#161616" />
            <ColorField label="Texto principal" value={textColor} onChange={setTextColor} placeholder="#f5f5f5" />
            <ColorField label="Borde" value={borderColor} onChange={setBorderColor} placeholder="#2a2a2a" />
            <ColorField label="Texto secundario" value={mutedColor} onChange={setMutedColor} placeholder="#9ca3af" />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost text-[11px]">Cancelar</button>
          <button onClick={handleSave} className="btn-primary text-[11px]">Guardar cambios</button>
        </div>
      </div>
    </div>
  );
}
