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

  const alertas = insights.filter((i) => i.severidad === 'critical' || i.severidad === 'warning');
  const wins = insights.filter((i) => i.severidad === 'positive');
  const diagnosticos = insights.filter((i) => i.severidad === 'diagnostic');
  const acciones = insights.filter((i) => i.verdict != null);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
        <h3 className="kpi-label">Análisis</h3>
        {onClose && (
          <button onClick={onClose} className="text-[10px] text-gray-600 hover:text-gray-400 px-2 py-0.5 rounded border border-white/[0.06] hover:border-white/[0.12] transition">✕</button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-[2px] px-3 py-2 border-b border-white/[0.06] bg-black/10 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-2.5 py-1 rounded text-[10px] font-semibold transition ${
              activeTab === t.key
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 px-3 py-2 border-b border-white/[0.06] shrink-0">
        {[
          { label: 'Alertas', value: alertas.length },
          { label: 'Wins', value: wins.length },
          { label: 'Acciones', value: acciones.length },
          { label: 'Notas', value: notes.length },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-2 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-gray-600">{item.label}</p>
            <p className="text-[14px] font-semibold text-app-primary mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <p className="text-[11px] text-gray-600 text-center py-8">Cargando...</p>
        ) : activeTab === 'notes' ? (
          <>
            {notes.length === 0 ? (
              <p className="text-[11px] text-gray-600 text-center py-4">Sin notas para esta sección.</p>
            ) : (
              notes.map((note) => (
                <div key={note._id} className="bg-white/[0.03] border border-white/[0.06] border-l-[3px] border-l-gray-500 rounded-lg p-3 mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-gray-500">
                      {note.author?.nombre || 'Equipo'}
                    </span>
                    <span className="text-[9px] text-gray-600">
                      {new Date(note.createdAt).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">{note.text}</p>
                  <button
                    onClick={() => handleDeleteNote(note._id)}
                    className="text-[9px] text-red-500 hover:text-red-400 mt-1 transition"
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
                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2 mt-1">Alertas y problemas</p>
                {alertas.map((i) => <InsightCard key={i._id} insight={i} onDismiss={handleDismiss} />)}
              </>
            )}
            {wins.length > 0 && (
              <>
                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2 mt-3">Wins</p>
                {wins.map((i) => <InsightCard key={i._id} insight={i} onDismiss={handleDismiss} />)}
              </>
            )}
            {diagnosticos.length > 0 && (
              <>
                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2 mt-3">Diagnóstico</p>
                {diagnosticos.map((i) => <InsightCard key={i._id} insight={i} onDismiss={handleDismiss} />)}
              </>
            )}
            {acciones.length > 0 && (
              <>
                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2 mt-3">Acciones recomendadas</p>
                {acciones.map((i) => <InsightCard key={i._id} insight={i} onDismiss={handleDismiss} />)}
              </>
            )}
            {insights.length === 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                <p className="text-[12px] text-app-primary">Todavía no hay análisis para esta sección.</p>
                <p className="text-[11px] text-gray-600 mt-2">
                  El botón de abajo genera o actualiza automáticamente Alertas, Wins y Acciones con el contexto de esta hoja.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {filtered.length === 0 ? (
              <p className="text-[11px] text-gray-600 text-center py-8">Sin resultados en este filtro.</p>
            ) : (
              filtered.map((i) => <InsightCard key={i._id} insight={i} onDismiss={handleDismiss} />)
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-white/[0.06] shrink-0 space-y-2">
        {activeTab === 'notes' && (
          <div className="flex gap-2">
            <input
              type="text"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Escribir nota..."
              className="input-dark flex-1 text-[11px]"
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
            />
            <button onClick={handleAddNote} disabled={addingNote || !noteText.trim()} className="btn-ghost text-[10px] disabled:opacity-50">
              {addingNote ? '...' : 'Agregar'}
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleGenerateAI}
            disabled={generating}
            className="flex-1 py-1.5 rounded text-[11px] font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition"
          >
            {generating ? 'Actualizando...' : 'Generar / actualizar insights'}
          </button>
        </div>
        <p className="text-[10px] text-gray-600">
          Esto alimenta los tabs de Alertas, Wins y Acciones para la sección actual.
        </p>
      </div>
    </div>
  );
}
