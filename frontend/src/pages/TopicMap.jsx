import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

const STATUS_LABELS = {
  draft: 'Borrador',
  active: 'Activo',
  paused: 'Pausado',
};

const STATUS_BADGE = {
  draft: 'badge-gray',
  active: 'badge-green',
  paused: 'badge-amber',
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
    setForm({ nombre: item.nombre, status: item.status || 'draft', description: item.description || '', performanceNotes: item.performanceNotes || '' });
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

  if (loading) return <div className="text-center py-12 text-[13px] text-gray-600">Cargando mapa de tópicos...</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Mapa de Tópicos</h1>
          <p className="page-subtitle">Estrategia de contenido y seguimiento de tópicos SEO.</p>
        </div>
        <button onClick={handleToggleForm} className="btn-primary">
          {showForm ? 'Cancelar' : '+ Agregar tópico'}
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
              <label className="kpi-label mb-1 block">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="input-dark w-full"
              >
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="paused">Pausado</option>
              </select>
            </div>
          </div>
          <div>
            <label className="kpi-label mb-1 block">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="input-dark w-full"
            />
          </div>
          <div>
            <label className="kpi-label mb-1 block">Notas de performance</label>
            <textarea
              value={form.performanceNotes}
              onChange={(e) => setForm({ ...form, performanceNotes: e.target.value })}
              rows={2}
              className="input-dark w-full"
            />
          </div>
          <button type="submit" className="btn-primary">
            {editId ? 'Actualizar' : 'Agregar'}
          </button>
        </form>
      )}

      {items.length === 0 ? (
        <div className="text-center py-12 text-[13px] text-gray-600">
          No hay tópicos agregados aún. Hacé click en "+ Agregar tópico" para empezar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => (
            <div key={item._id} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[13px] font-bold text-white truncate">{item.nombre}</h3>
                  <span className={`mt-1.5 inline-block ${STATUS_BADGE[item.status] || STATUS_BADGE.draft}`}>
                    {STATUS_LABELS[item.status] || item.status}
                  </span>
                </div>
                <div className="flex gap-2 ml-2 shrink-0">
                  <button onClick={() => handleEdit(item)} className="text-[11px] text-gray-500 hover:text-gray-300 transition">Editar</button>
                  <button onClick={() => handleDelete(item._id)} className="text-[11px] text-gray-500 hover:text-red-400 transition">Eliminar</button>
                </div>
              </div>
              {item.description && (
                <p className="mt-2 text-[12px] text-gray-500 leading-relaxed">{item.description}</p>
              )}
              {item.performanceNotes && (
                <div className="mt-2.5 pt-2.5 border-t border-white/[0.06]">
                  <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">Notas de performance</p>
                  <p className="text-[12px] text-gray-500 leading-relaxed">{item.performanceNotes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}