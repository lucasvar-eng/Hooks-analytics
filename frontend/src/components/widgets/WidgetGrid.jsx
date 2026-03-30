import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import WidgetRenderer from './WidgetRenderer';
import WidgetLibrary from './WidgetLibrary';

// ─── Size → CSS grid classes ─────────────────────────────────────────────────

const SIZE_CLASSES = {
  sm: 'col-span-1',
  md: 'col-span-1 sm:col-span-2',
  lg: 'col-span-1 sm:col-span-2 lg:col-span-3',
  full: 'col-span-1 sm:col-span-2 lg:col-span-4',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function WidgetGrid({ storeId, pageId = 'dashboard', metrics, objetivos, from, to }) {
  const [widgets, setWidgets] = useState([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const current = metrics?.current || {};
  const deltas = metrics?.deltas || {};

  // ── Fetch widgets (or seed defaults) ──────────────────────────────────────
  const fetchWidgets = useCallback(async () => {
    try {
      let { data } = await api.get(`/api/stores/${storeId}/widgets`, { params: { pageId } });

      // Auto-seed defaults on first load
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

  // ── CRUD handlers ─────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="text-center py-12 text-xs text-gray-500 dark:text-gray-500">Cargando dashboard...</div>;
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
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {editMode ? '✓ Listo' : '✎ Editar dashboard'}
          </button>
          {editMode && (
            <>
              <button
                onClick={() => setShowLibrary(!showLibrary)}
                className="px-2.5 py-1 text-[10px] font-semibold rounded bg-primary-600 text-white hover:bg-primary-700 transition"
              >
                + Agregar widget
              </button>
              <button
                onClick={handleReset}
                className="px-2.5 py-1 text-[10px] font-semibold rounded bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-red-500 transition"
              >
                ↻ Reset
              </button>
            </>
          )}
        </div>
        <span className="text-[9px] text-gray-400 dark:text-gray-500">{widgets.length} widgets</span>
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

          // Separators render differently
          if (isSeparator) {
            return (
              <div key={widget._id} className={`${SIZE_CLASSES.full} ${editMode ? 'relative group' : ''}`}>
                <WidgetRenderer widget={widget} current={current} deltas={deltas} objetivos={objetivos} storeId={storeId} from={from} to={to} />
                {editMode && <WidgetControls idx={idx} total={widgets.length} onMove={handleMove} onRemove={() => handleRemove(widget._id)} />}
              </div>
            );
          }

          // Table widgets don't need the card wrapper padding
          const isTable = widget.type === 'table';

          return (
            <div
              key={widget._id}
              className={`${sizeClass} bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 ${isTable ? '' : 'p-3.5'} ${editMode ? 'relative group ring-1 ring-transparent hover:ring-primary-500/30' : 'hover:border-gray-300 dark:hover:border-gray-700'} transition`}
            >
              <WidgetRenderer widget={widget} current={current} deltas={deltas} objetivos={objetivos} storeId={storeId} from={from} to={to} />
              {editMode && <WidgetControls idx={idx} total={widgets.length} onMove={handleMove} onRemove={() => handleRemove(widget._id)} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Widget Controls (edit mode overlay) ─────────────────────────────────────

function WidgetControls({ idx, total, onMove, onRemove }) {
  return (
    <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition bg-gray-900/80 rounded px-1 py-0.5">
      <button
        onClick={() => onMove(idx, -1)}
        disabled={idx === 0}
        className="p-0.5 text-gray-300 hover:text-white disabled:opacity-30 transition"
        title="Mover antes"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={() => onMove(idx, 1)}
        disabled={idx === total - 1}
        className="p-0.5 text-gray-300 hover:text-white disabled:opacity-30 transition"
        title="Mover después"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <button
        onClick={onRemove}
        className="p-0.5 text-gray-300 hover:text-red-400 transition"
        title="Eliminar"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
