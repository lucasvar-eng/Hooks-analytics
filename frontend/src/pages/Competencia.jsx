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

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando competencia...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Competencia</h2>
        <button
          onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ nombre: '', url: '', notas: '' }); }}
          className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
        >
          {showForm ? 'Cancelar' : '+ Agregar competidor'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Nombre</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
            </div>
            <div>
              <label className="text-xs text-gray-500">URL</label>
              <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" placeholder="https://..." />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Notas</label>
            <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={2} className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </div>
          <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
            {editId ? 'Actualizar' : 'Agregar'}
          </button>
        </form>
      )}

      {competitors.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No hay competidores agregados aún. Hacé click en "+ Agregar competidor" para empezar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {competitors.map((c) => (
            <div key={c._id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{c.nombre}</h3>
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:underline">{c.url}</a>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(c)} className="text-xs text-gray-500 hover:text-indigo-500">Editar</button>
                  <button onClick={() => handleDelete(c._id)} className="text-xs text-gray-500 hover:text-red-500">Eliminar</button>
                </div>
              </div>
              {c.notas && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{c.notas}</p>}
              {c.analysisResult && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-750 rounded text-sm text-gray-700 dark:text-gray-300">
                  {c.analysisResult}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
