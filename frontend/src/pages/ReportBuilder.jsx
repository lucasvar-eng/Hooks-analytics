import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';

const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard General' },
  { id: 'meta', label: 'Meta Ads' },
  { id: 'costos', label: 'Costos & P&L' },
  { id: 'productos', label: 'Productos' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'creativos', label: 'Creativos' },
  { id: 'cashflow', label: 'Cashflow' },
];

export default function ReportBuilder() {
  const { storeId } = useParams();
  const { from, to } = useSelector((state) => state.date);

  const [selected, setSelected] = useState(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.id, true]))
  );
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(null); // { label, current, total }
  const [report, setReport] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  function toggleSection(id) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleAll(val) {
    setSelected(Object.fromEntries(SECTIONS.map((s) => [s.id, val])));
  }

  const selectedSections = SECTIONS.filter((s) => selected[s.id]);

  async function handleGenerate() {
    if (selectedSections.length === 0) return;
    setGenerating(true);
    setReport('');
    setSavedMsg('');

    let combined = '';
    const total = selectedSections.length;

    for (let i = 0; i < selectedSections.length; i++) {
      const section = selectedSections[i];
      setProgress({ label: section.label, current: i + 1, total });

      try {
        const { data } = await api.post(`/api/stores/${storeId}/ai/analyze`, {
          section: section.id,
          from,
          to,
        });
        combined += `## ${section.label}\n\n${data.analysis}\n\n`;
      } catch (err) {
        combined += `## ${section.label}\n\n_Error al analizar esta sección._\n\n`;
      }
    }

    setReport(combined.trim());
    setProgress(null);
    setGenerating(false);
  }

  async function handleSave() {
    if (!report) return;
    setSaving(true);
    setSavedMsg('');
    try {
      await api.post(`/api/stores/${storeId}/reports`, {
        content: report,
        from,
        to,
        sections: selectedSections.map((s) => s.id),
      });
      setSavedMsg('Reporte guardado correctamente.');
    } catch {
      setSavedMsg('Error al guardar el reporte.');
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    window.print();
  }

  const allSelected = selectedSections.length === SECTIONS.length;
  const noneSelected = selectedSections.length === 0;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Generador de Reportes
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Seleccioná las secciones a incluir y generá un análisis completo con IA.
        </p>
      </div>

      {/* Section selector + date */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm text-gray-800 dark:text-gray-200">
            Secciones a incluir
          </h2>
          <div className="flex gap-3">
            <button
              onClick={() => toggleAll(true)}
              disabled={allSelected}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-40 disabled:no-underline"
            >
              Seleccionar todas
            </button>
            <button
              onClick={() => toggleAll(false)}
              disabled={noneSelected}
              className="text-xs text-gray-500 dark:text-gray-400 hover:underline disabled:opacity-40 disabled:no-underline"
            >
              Desmarcar todas
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SECTIONS.map((section) => (
            <label
              key={section.id}
              className="flex items-center gap-2 cursor-pointer select-none group"
            >
              <input
                type="checkbox"
                checked={selected[section.id]}
                onChange={() => toggleSection(section.id)}
                className="accent-indigo-600 w-4 h-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                {section.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Date range (read-only) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
        <h2 className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-2">
          Período analizado
        </h2>
        <div className="flex gap-6 text-sm text-gray-600 dark:text-gray-400">
          <span>
            <span className="font-medium text-gray-800 dark:text-gray-200">Desde: </span>
            {from || '—'}
          </span>
          <span>
            <span className="font-medium text-gray-800 dark:text-gray-200">Hasta: </span>
            {to || '—'}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Para cambiar el período usá el selector de fechas global.
        </p>
      </div>

      {/* Generate button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={generating || noneSelected}
          className="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50 transition"
        >
          {generating ? 'Generando...' : 'Generar reporte'}
        </button>
        {noneSelected && (
          <span className="text-xs text-red-500 dark:text-red-400">
            Seleccioná al menos una sección.
          </span>
        )}
      </div>

      {/* Progress */}
      {progress && (
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 animate-spin text-violet-600 dark:text-violet-400"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          <span className="text-sm text-violet-600 dark:text-violet-400">
            Analizando {progress.label}... ({progress.current}/{progress.total})
          </span>
        </div>
      )}

      {/* Report preview */}
      {report && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm text-gray-800 dark:text-gray-200">
              Vista previa del reporte
            </h2>
            <div className="flex items-center gap-2">
              {savedMsg && (
                <span
                  className={`text-xs ${
                    savedMsg.startsWith('Error')
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-green-600 dark:text-green-400'
                  }`}
                >
                  {savedMsg}
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50 transition"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              >
                Exportar
              </button>
            </div>
          </div>

          {/* Markdown preview rendered as styled HTML */}
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans leading-relaxed">
              {report}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
