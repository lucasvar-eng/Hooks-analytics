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
  const [analyzing, setAnalyzing] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/stores/${storeId}/competitors`);
      setCompetitors(data);
    } catch {}
    setLoading(false);
  }, [storeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
      fetchData();
    } catch {}
  };

  const handleEdit = (c) => {
    setForm({ nombre: c.nombre, url: c.url || '', notas: c.notas || '' });
    setEditId(c._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    await api.delete(`/api/stores/${storeId}/competitors/${id}`);
    fetchData();
  };

  const handleAnalyze = async (id) => {
    setAnalyzing(id);
    try {
      await api.post(`/api/stores/${storeId}/competitors/${id}/analyze`);
      fetchData();
    } catch {}
    setAnalyzing(null);
  };

  if (loading) return <div className="text-center py-12 text-[13px] text-gray-600">Cargando competencia...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Competencia</h1>
          <p className="page-subtitle">Seguimiento y análisis AI de competidores.</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ nombre: '', url: '', notas: '' }); }}
          className="btn-primary"
        >
          {showForm ? 'Cancelar' : '+ Agregar competidor'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="kpi-label mb-1 block">Nombre</label>
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                className="input-dark w-full"
              />
            </div>
            <div>
              <label className="kpi-label mb-1 block">URL</label>
              <input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="input-dark w-full"
                placeholder="https://..."
              />
            </div>
          </div>
          <div>
            <label className="kpi-label mb-1 block">Notas</label>
            <textarea
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              rows={2}
              className="input-dark w-full"
            />
          </div>
          <button type="submit" className="btn-primary">
            {editId ? 'Actualizar' : 'Agregar'}
          </button>
        </form>
      )}

      {competitors.length === 0 ? (
        <div className="text-center py-12 text-[13px] text-gray-600">
          No hay competidores agregados aún. Hacé click en "+ Agregar competidor" para empezar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {competitors.map((c) => (
            <div key={c._id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[14px] font-bold text-white">{c.nombre}</h3>
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400 hover:text-blue-300 transition">{c.url}</a>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAnalyze(c._id)}
                    disabled={analyzing === c._id}
                    className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-50 transition"
                  >
                    {analyzing === c._id ? 'Analizando...' : 'Analizar AI'}
                  </button>
                  <button onClick={() => handleEdit(c)} className="text-[11px] text-gray-500 hover:text-gray-300 transition">Editar</button>
                  <button onClick={() => handleDelete(c._id)} className="text-[11px] text-gray-500 hover:text-red-400 transition">Eliminar</button>
                </div>
              </div>
              {c.notas && <p className="mt-2 text-[12px] text-gray-500 leading-relaxed">{c.notas}</p>}
              {c.analysisResult && (
                <div className="mt-3 p-3 bg-blue-500/[0.07] border border-blue-500/20 rounded-lg text-[12px] text-gray-400 leading-relaxed">
                  <p className="text-[10px] font-bold text-blue-400 mb-1.5 uppercase tracking-wider">
                    Análisis AI {c.lastAnalysis && `— ${new Date(c.lastAnalysis).toLocaleDateString('es-AR')}`}
                  </p>
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