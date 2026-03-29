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

  if (loading) return <div className="text-center py-12 text-gray-500 dark:text-gray-400">Cargando mapa de tópicos...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Mapa de Tópicos</h2>
        <button
          onClick={handleToggleForm}
          className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
        >
          {showForm ? 'Cancelar' : '+ Agregar tópico'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Nombre</label>
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              >
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="paused">Pausado</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Notas de performance</label>
            <textarea
              value={form.performanceNotes}
              onChange={(e) => setForm({ ...form, performanceNotes: e.target.value })}
              rows={2}
              className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
            {editId ? 'Actualizar' : 'Agregar'}
          </button>
        </form>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No hay tópicos agregados aún. Hacé click en "+ Agregar tópico" para empezar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item._id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{item.nombre}</h3>
                  <span className={`mt-1 inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_BADGE[item.status] || STATUS_BADGE.draft}`}>
                    {STATUS_LABELS[item.status] || item.status}
                  </span>
                </div>
                <div className="flex gap-2 ml-2 shrink-0">
                  <button onClick={() => handleEdit(item)} className="text-xs text-gray-500 hover:text-indigo-500">Editar</button>
                  <button onClick={() => handleDelete(item._id)} className="text-xs text-gray-500 hover:text-red-500">Eliminar</button>
                </div>
              </div>
              {item.description && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{item.description}</p>
              )}
              {item.performanceNotes && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-500 font-medium mb-0.5">Notas de performance</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{item.performanceNotes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
