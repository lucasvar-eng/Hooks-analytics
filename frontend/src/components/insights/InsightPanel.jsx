import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import InsightCard from './InsightCard';

const TABS = [
  { key: 'all', label: 'Todos' },
  { key: 'alertas', label: 'Alertas', filter: (i) => i.severidad === 'critical' || i.severidad === 'warning' },
  { key: 'wins', label: 'Wins', filter: (i) => i.severidad === 'positive' },
  { key: 'actions', label: 'Acciones', filter: (i) => i.verdict != null },
  { key: 'notes', label: 'Notas', isNotes: true },
];

export default function InsightPanel({ storeId, section, onClose }) {
  const [insights, setInsights] = useState([]);
  const [notes, setNotes] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const [insRes, notesRes] = await Promise.all([
        api.get(`/api/stores/${storeId}/insights`, { params: { section, estado: 'active' } }),
        api.get(`/api/stores/${storeId}/notes`, { params: { section } }),
      ]);
      setInsights(insRes.data);
      setNotes(notesRes.data);
    } catch {
      // endpoints may not exist yet
    }
    setLoading(false);
  }, [storeId, section]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDismiss = async (insightId) => {
    try {
      await api.put(`/api/stores/${storeId}/insights/${insightId}/dismiss`);
      setInsights((prev) => prev.filter((i) => i._id !== insightId));
    } catch {}
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      await api.post(`/api/stores/${storeId}/notes`, { section, text: noteText.trim() });
      setNoteText('');
      const { data } = await api.get(`/api/stores/${storeId}/notes`, { params: { section } });
      setNotes(data);
    } catch {}
    setAddingNote(false);
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await api.delete(`/api/stores/${storeId}/notes/${noteId}`);
      setNotes((prev) => prev.filter((n) => n._id !== noteId));
    } catch {}
  };

  const handleGenerateAI = async () => {
    setGenerating(true);
    try {
      await api.post(`/api/stores/${storeId}/insights/generate`, { section });
      await fetchData();
    } catch {}
    setGenerating(false);
  };

  const currentTab = TABS.find((t) => t.key === activeTab);
  const filtered = currentTab?.filter ? insights.filter(currentTab.filter) : insights;

  // Group insights by category for "all" tab
  const alertas = insights.filter((i) => i.severidad === 'critical' || i.severidad === 'warning');
  const wins = insights.filter((i) => i.severidad === 'positive');
  const diagnosticos = insights.filter((i) => i.severidad === 'diagnostic');
  const acciones = insights.filter((i) => i.verdict != null);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/60 flex items-center justify-between shrink-0">
        <h3 className="text-[12px] font-bold text-gray-700 dark:text-white uppercase tracking-wide">Análisis</h3>
        {onClose && (
          <button onClick={onClose} className="text-[10px] text-gray-400 hover:text-gray-300 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700/60 hover:border-gray-600 transition">✕</button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-[2px] px-3 py-2 border-b border-gray-200 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-900 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-2.5 py-1 rounded text-[10px] font-semibold transition ${
              activeTab === t.key
                ? 'bg-primary-600 text-white'
                : 'text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-8">Cargando...</p>
        ) : activeTab === 'notes' ? (
          <>
            {notes.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Sin notas para esta sección.</p>
            ) : (
              notes.map((note) => (
                <div key={note._id} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-l-[3px] border-l-gray-400 rounded-lg p-3 mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400">
                      {note.author?.nombre || 'Equipo'}
                    </span>
                    <span className="text-[9px] text-gray-400">
                      {new Date(note.createdAt).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">{note.text}</p>
                  <button
                    onClick={() => handleDeleteNote(note._id)}
                    className="text-[9px] text-red-400 hover:text-red-600 mt-1"
                  >
                    Eliminar
                  </button>
                </div>
              ))
            )}
          </>
        ) : activeTab === 'all' ? (
          <>
            {alertas.length > 0 && (
              <>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2 mt-1">Alertas y problemas</p>
                {alertas.map((i) => <InsightCard key={i._id} insight={i} onDismiss={handleDismiss} />)}
              </>
            )}
            {wins.length > 0 && (
              <>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2 mt-3">Wins</p>
                {wins.map((i) => <InsightCard key={i._id} insight={i} onDismiss={handleDismiss} />)}
              </>
            )}
            {diagnosticos.length > 0 && (
              <>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2 mt-3">Diagnóstico</p>
                {diagnosticos.map((i) => <InsightCard key={i._id} insight={i} onDismiss={handleDismiss} />)}
              </>
            )}
            {acciones.length > 0 && (
              <>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2 mt-3">Acciones recomendadas</p>
                {acciones.map((i) => <InsightCard key={i._id} insight={i} onDismiss={handleDismiss} />)}
              </>
            )}
            {insights.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-8">Sin insights para esta sección. Generá un análisis con AI.</p>
            )}
          </>
        ) : (
          <>
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">Sin resultados en este filtro.</p>
            ) : (
              filtered.map((i) => <InsightCard key={i._id} insight={i} onDismiss={handleDismiss} />)
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 shrink-0 space-y-2">
        {activeTab === 'notes' && (
          <div className="flex gap-2">
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Escribir nota..."
              className="flex-1 px-2 py-1.5 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
            />
            <button onClick={handleAddNote} disabled={addingNote || !noteText.trim()} className="px-2 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 disabled:opacity-50">
              {addingNote ? '...' : 'Agregar'}
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleGenerateAI}
            disabled={generating}
            className="flex-1 py-1.5 rounded text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 disabled:opacity-50 transition"
          >
            {generating ? 'Generando...' : 'Generar análisis AI'}
          </button>
        </div>
      </div>
    </div>
  );
}
