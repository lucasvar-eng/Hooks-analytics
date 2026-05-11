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
  const store = useSelector((state) =>
    state.stores.stores.find((s) => s._id === storeId)
  );

  const [selected, setSelected] = useState(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.id, true]))
  );
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(null);
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
  const allSelected = selectedSections.length === SECTIONS.length;
  const noneSelected = selectedSections.length === 0;

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
        const { data } = await api.post(`/api/stores/${storeId}/ai/analyze`, { section: section.id, from, to });
        combined += `## ${section.label}\n\n${data.analysis}\n\n`;
      } catch {
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
    const storeLabel = store?.nombre || store?.name || 'Reporte';
    const titulo = `Reporte completo · ${storeLabel} · ${from || 'inicio'} a ${to || 'hoy'}`;
    try {
      await api.post(`/api/stores/${storeId}/reports`, {
        titulo,
        contenido: report,
        tipo: 'report',
        section: selectedSections.length === 1 ? selectedSections[0].id : 'all',
        dateRange: { from, to },
        generationMode: 'ai',
      });
      setSavedMsg('Reporte guardado correctamente.');
    } catch {
      setSavedMsg('Error al guardar el reporte.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="page-title">Generador de Reportes</h1>
        <p className="page-subtitle">Seleccioná las secciones a incluir y generá un análisis completo con IA.</p>
      </div>

      {/* Section selector */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] font-semibold text-white">Secciones a incluir</p>
          <div className="flex gap-3">
            <button
              onClick={() => toggleAll(true)}
              disabled={allSelected}
              className="text-[12px] text-blue-400 hover:text-blue-300 disabled:opacity-40 transition"
            >
              Seleccionar todas
            </button>
            <button
              onClick={() => toggleAll(false)}
              disabled={noneSelected}
              className="text-[12px] text-gray-500 hover:text-gray-300 disabled:opacity-40 transition"
            >
              Desmarcar todas
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SECTIONS.map((section) => (
            <label key={section.id} className="flex items-center gap-2.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={selected[section.id]}
                onChange={() => toggleSection(section.id)}
                className="w-4 h-4 accent-blue-500 rounded"
              />
              <span className="text-[13px] text-gray-400 group-hover:text-gray-200 transition">
                {section.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Date range */}
      <div className="card p-4">
        <p className="text-[13px] font-semibold text-white mb-2">Período analizado</p>
        <div className="flex gap-6 text-[12px] text-gray-400">
          <span><span className="text-gray-300 font-medium">Desde: </span>{from || '—'}</span>
          <span><span className="text-gray-300 font-medium">Hasta: </span>{to || '—'}</span>
        </div>
        <p className="mt-1 text-[11px] text-gray-600">Para cambiar el período usá el selector de fechas global.</p>
      </div>

      {/* Generate button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={generating || noneSelected}
          className="btn-primary disabled:opacity-50"
        >
          {generating ? 'Generando...' : 'Generar reporte'}
        </button>
        {noneSelected && (
          <span className="text-[12px] text-red-400">Seleccioná al menos una sección.</span>
        )}
      </div>

      {/* Progress */}
      {progress && (
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-[13px] text-blue-400">
            Analizando {progress.label}... ({progress.current}/{progress.total})
          </span>
        </div>
      )}

      {/* Report preview */}
      {report && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-semibold text-white">Vista previa del reporte</p>
            <div className="flex items-center gap-2">
              {savedMsg && (
                <span className={`text-[12px] ${savedMsg.startsWith('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                  {savedMsg}
                </span>
              )}
              <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => window.print()} className="btn-secondary">
                Exportar
              </button>
            </div>
          </div>
          <pre className="whitespace-pre-wrap text-[12px] text-gray-400 font-sans leading-relaxed">
            {report}
          </pre>
        </div>
      )}
    </div>
  );
}