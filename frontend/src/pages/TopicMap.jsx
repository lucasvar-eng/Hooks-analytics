import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

const STATUS_LABELS = {
  draft: 'Borrador',
  active: 'Activo',
  paused: 'Pausado',
};

const STATUS_BADGE = {
  draft: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  active: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  paused: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
};

const EMPTY_FORM = { nombre: '', status: 'draft', description: '', performanceNotes: '' };

export default function TopicMap() {
  const { storeId } = useParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/stores/${storeId}/topic-maps`);
      setItems(data);
    } catch {}
    setLoading(false);
  }, [storeId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.put(`/api/stores/${storeId}/topic-maps/${editId}`, form);
      } else {
        await api.post(`/api/stores/${storeId}/topic-maps`, form);
      }
      setForm(EMPTY_FORM);
      setEditId(null);
      setShowForm(false);
      fetchItems();
    } catch {}
  };

  const handleEdit = (item) => {
    setForm({
      nombre: item.nombre,
      status: item.status || 'draft',
      description: item.description || '',
      performanceNotes: item.performanceNotes || '',
    });
    setEditId(item._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    await api.delete(`/api/stores/${storeId}/topic-maps/${id}`);
    fetchItems();
  };

  const handleToggleForm = () => {
    setShowForm(!showForm);
    setEditId(null);
    setForm(EMPTY_FORM);
  };

  if (loading) return <div className="text-center py-12 text-xs text-gray-500 dark:text-gray-500">Cargando mapa de tópicos...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="section-label">Mapa de Tópicos</p>
        <button
          onClick={handleToggleForm}
          className="px-3 py-1.5 bg-primary-600 text-white text-[11px] font-semibold rounded hover:bg-primary-700 transition"
        >
          {showForm ? 'Cancelar' : '+ Agregar tópico'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Nombre</label>
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                className="w-full mt-1 px-2.5 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700/60 rounded bg-white dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full mt-1 px-2.5 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700/60 rounded bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="paused">Pausado</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full mt-1 px-2.5 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700/60 rounded bg-white dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Notas de performance</label>
            <textarea
              value={form.performanceNotes}
              onChange={(e) => setForm({ ...form, performanceNotes: e.target.value })}
              rows={2}
              className="w-full mt-1 px-2.5 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700/60 rounded bg-white dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-primary-600 text-white text-[11px] font-semibold rounded hover:bg-primary-700 transition">
            {editId ? 'Actualizar' : 'Agregar'}
          </button>
        </form>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12 text-[11px] text-gray-400 dark:text-gray-500">
          No hay tópicos agregados aún. Hacé click en "+ Agregar tópico" para empezar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => (
            <div key={item._id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[13px] font-bold text-gray-900 dark:text-white truncate">{item.nombre}</h3>
                  <span className={`mt-1 inline-block px-1.5 py-0.5 text-[9px] font-bold rounded ${STATUS_BADGE[item.status] || STATUS_BADGE.draft}`}>
                    {STATUS_LABELS[item.status] || item.status}
                  </span>
                </div>
                <div className="flex gap-2 ml-2 shrink-0">
                  <button onClick={() => handleEdit(item)} className="text-[10px] text-gray-400 hover:text-primary-500 transition">Editar</button>
                  <button onClick={() => handleDelete(item._id)} className="text-[10px] text-gray-400 hover:text-red-500 transition">Eliminar</button>
                </div>
              </div>
              {item.description && (
                <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{item.description}</p>
              )}
              {item.performanceNotes && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/60">
                  <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Notas de performance</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{item.performanceNotes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
