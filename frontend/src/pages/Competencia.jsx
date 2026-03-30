import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

export default function Competencia() {
  const { storeId } = useParams();
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', url: '', notas: '' });
  const [editId, setEditId] = useState(null);
  const [analyzing, setAnalyzing] = useState(null); // competitor id being analyzed

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/stores/${storeId}/competitors`);
      setCompetitors(data);
    } catch {}
    setLoading(false);
  }, [storeId]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.put(`/api/stores/${storeId}/competitors/${editId}`, form);
      } else {
        await api.post(`/api/stores/${storeId}/competitors`, form);
      }
      setForm({ nombre: '', url: '', notas: '' });
      setEditId(null);
      setShowForm(false);
      fetch();
    } catch {}
  };

  const handleEdit = (c) => {
    setForm({ nombre: c.nombre, url: c.url || '', notas: c.notas || '' });
    setEditId(c._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    await api.delete(`/api/stores/${storeId}/competitors/${id}`);
    fetch();
  };

  const handleAnalyze = async (id) => {
    setAnalyzing(id);
    try {
      await api.post(`/api/stores/${storeId}/competitors/${id}/analyze`);
      fetch();
    } catch {}
    setAnalyzing(null);
  };

  if (loading) return <div className="text-center py-12 text-xs text-gray-500 dark:text-gray-500">Cargando competencia...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="section-label">Competencia</p>
        <button
          onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ nombre: '', url: '', notas: '' }); }}
          className="px-3 py-1.5 bg-primary-600 text-white text-[11px] font-semibold rounded hover:bg-primary-700 transition"
        >
          {showForm ? 'Cancelar' : '+ Agregar competidor'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Nombre</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required className="w-full mt-1 px-2.5 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700/60 rounded bg-white dark:bg-gray-800 dark:text-gray-100" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">URL</label>
              <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="w-full mt-1 px-2.5 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700/60 rounded bg-white dark:bg-gray-800 dark:text-gray-100" placeholder="https://..." />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Notas</label>
            <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={2} className="w-full mt-1 px-2.5 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700/60 rounded bg-white dark:bg-gray-800 dark:text-gray-100" />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-primary-600 text-white text-[11px] font-semibold rounded hover:bg-primary-700 transition">
            {editId ? 'Actualizar' : 'Agregar'}
          </button>
        </form>
      )}

      {competitors.length === 0 ? (
        <div className="text-center py-12 text-[11px] text-gray-400 dark:text-gray-500">
          No hay competidores agregados aún. Hacé click en "+ Agregar competidor" para empezar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {competitors.map((c) => (
            <div key={c._id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[13px] font-bold text-gray-900 dark:text-white">{c.nombre}</h3>
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary-500 hover:underline">{c.url}</a>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAnalyze(c._id)}
                    disabled={analyzing === c._id}
                    className="text-[10px] font-semibold text-primary-500 hover:underline disabled:opacity-50"
                  >
                    {analyzing === c._id ? 'Analizando...' : 'Analizar AI'}
                  </button>
                  <button onClick={() => handleEdit(c)} className="text-[10px] text-gray-400 hover:text-primary-500 transition">Editar</button>
                  <button onClick={() => handleDelete(c._id)} className="text-[10px] text-gray-400 hover:text-red-500 transition">Eliminar</button>
                </div>
              </div>
              {c.notas && <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{c.notas}</p>}
              {c.analysisResult && (
                <div className="mt-3 p-2.5 bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-800/30 rounded text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p className="text-[9px] font-bold text-primary-500 dark:text-primary-400 mb-1 uppercase tracking-wider">Análisis AI {c.lastAnalysis && `— ${new Date(c.lastAnalysis).toLocaleDateString('es-AR')}`}</p>
                  <div
                    dangerouslySetInnerHTML={{
                      __html: c.analysisResult
                        .replace(/\n/g, '<br>')
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/^### (.*)/gm, '<h4 class="font-semibold mt-2">$1</h4>')
                        .replace(/^## (.*)/gm, '<h3 class="font-bold mt-2">$1</h3>')
                        .replace(/^- (.*)/gm, '<li>$1</li>'),
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
