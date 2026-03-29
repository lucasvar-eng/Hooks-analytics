import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import WidgetRenderer from './WidgetRenderer';
import WidgetLibrary from './WidgetLibrary';

export default function WidgetGrid({ storeId, pageId = 'dashboard', metrics }) {
  const [widgets, setWidgets] = useState([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchWidgets = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/stores/${storeId}/widgets`, { params: { pageId } });
      setWidgets(data);
    } catch {}
    setLoading(false);
  }, [storeId, pageId]);

  useEffect(() => { fetchWidgets(); }, [fetchWidgets]);

  const handleAdd = async (widgetData) => {
    try {
      await api.post(`/api/stores/${storeId}/widgets`, { ...widgetData, pageId });
      fetchWidgets();
    } catch {}
  };

  const handleRemove = async (widgetId) => {
    try {
      await api.delete(`/api/stores/${storeId}/widgets/${widgetId}`);
      setWidgets(widgets.filter((w) => w._id !== widgetId));
    } catch {}
  };

  const handleMove = async (index, direction) => {
    const swapIdx = index + direction;
    if (swapIdx < 0 || swapIdx >= widgets.length) return;

    const updated = [...widgets];
    [updated[index], updated[swapIdx]] = [updated[swapIdx], updated[index]];
    // Update order values
    const reordered = updated.map((w, i) => ({ ...w, order: i }));
    setWidgets(reordered);

    try {
      await api.put(`/api/stores/${storeId}/widgets/reorder`, {
        items: reordered.map((w) => ({ _id: w._id, order: w.order })),
      });
    } catch {}
  };

  if (loading) return null;

  // Don't show section at all if no widgets and not showing library
  if (widgets.length === 0 && !showLibrary) {
    return (
      <div className="flex justify-end">
        <button
          onClick={() => setShowLibrary(true)}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          + Agregar widgets al dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase">Widgets</h3>
        <button
          onClick={() => setShowLibrary(!showLibrary)}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {showLibrary ? 'Cancelar' : '+ Agregar'}
        </button>
      </div>

      {showLibrary && (
        <WidgetLibrary onAdd={handleAdd} onClose={() => setShowLibrary(false)} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {widgets.map((widget, idx) => (
          <div
            key={widget._id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 relative group"
          >
            {/* Controls — visible on hover */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
              <button
                onClick={() => handleMove(idx, -1)}
                disabled={idx === 0}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                title="Mover arriba"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => handleMove(idx, 1)}
                disabled={idx === widgets.length - 1}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                title="Mover abajo"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => handleRemove(widget._id)}
                className="p-1 text-gray-400 hover:text-red-500"
                title="Eliminar"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <WidgetRenderer widget={widget} metrics={metrics} />
          </div>
        ))}
      </div>
    </div>
  );
}
