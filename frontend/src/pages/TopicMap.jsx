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

const PRIORITY_BADGE = {
  high: 'badge-red',
  medium: 'badge-amber',
  low: 'badge-blue',
};

const AWARENESS_LABELS = {
  unaware: 'No consciente',
  'problem-aware': 'Problema',
  'solution-aware': 'Solución',
  'product-aware': 'Producto',
  'most-aware': 'Muy consciente',
  unknown: 'Sin definir',
};

const EMPTY_FORM = {
  nombre: '',
  status: 'draft',
  priority: 'medium',
  avatar: '',
  awarenessLevel: 'unknown',
  angle: '',
  territory: '',
  symptom: '',
  objection: '',
  recommendedFormat: '',
  stage: 'unknown',
  hypothesis: '',
  tags: '',
  description: '',
  performanceNotes: '',
};

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

  const handleEdit = (item) => {
    setForm({
      nombre: item.nombre,
      status: item.status || 'draft',
      priority: item.priority || 'medium',
      avatar: item.avatar || '',
      awarenessLevel: item.awarenessLevel || 'unknown',
      angle: item.angle || '',
      territory: item.territory || '',
      symptom: item.symptom || '',
      objection: item.objection || '',
      recommendedFormat: item.recommendedFormat || '',
      stage: item.stage || 'unknown',
      hypothesis: item.hypothesis || '',
      tags: (item.tags || []).join(', '),
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    };
    try {
      if (editId) {
        await api.put(`/api/stores/${storeId}/topic-maps/${editId}`, payload);
      } else {
        await api.post(`/api/stores/${storeId}/topic-maps`, payload);
      }
      setForm(EMPTY_FORM);
      setEditId(null);
      setShowForm(false);
      fetchItems();
    } catch {}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="kpi-label mb-1 block">Prioridad</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input-dark w-full">
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>
            <div>
              <label className="kpi-label mb-1 block">Avatar</label>
              <input value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value })} className="input-dark w-full" />
            </div>
            <div>
              <label className="kpi-label mb-1 block">Nivel de consciencia</label>
              <select value={form.awarenessLevel} onChange={(e) => setForm({ ...form, awarenessLevel: e.target.value })} className="input-dark w-full">
                <option value="unknown">Sin definir</option>
                <option value="unaware">No consciente</option>
                <option value="problem-aware">Problema</option>
                <option value="solution-aware">Solución</option>
                <option value="product-aware">Producto</option>
                <option value="most-aware">Muy consciente</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="kpi-label mb-1 block">Ángulo</label>
              <input value={form.angle} onChange={(e) => setForm({ ...form, angle: e.target.value })} className="input-dark w-full" />
            </div>
            <div>
              <label className="kpi-label mb-1 block">Territorio</label>
              <input value={form.territory} onChange={(e) => setForm({ ...form, territory: e.target.value })} className="input-dark w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="kpi-label mb-1 block">Síntoma / dolor</label>
              <textarea value={form.symptom} onChange={(e) => setForm({ ...form, symptom: e.target.value })} rows={2} className="input-dark w-full" />
            </div>
            <div>
              <label className="kpi-label mb-1 block">Objeción que ataca</label>
              <textarea value={form.objection} onChange={(e) => setForm({ ...form, objection: e.target.value })} rows={2} className="input-dark w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="kpi-label mb-1 block">Formato sugerido</label>
              <input value={form.recommendedFormat} onChange={(e) => setForm({ ...form, recommendedFormat: e.target.value })} className="input-dark w-full" />
            </div>
            <div>
              <label className="kpi-label mb-1 block">Estado estratégico</label>
              <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} className="input-dark w-full">
                <option value="unknown">Sin definir</option>
                <option value="testing">Testing</option>
                <option value="scaling">Scaling</option>
                <option value="saturated">Saturado</option>
                <option value="paused">Pausado</option>
              </select>
            </div>
            <div>
              <label className="kpi-label mb-1 block">Tags</label>
              <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="input-dark w-full" placeholder="ej: oferta, dolor, trust" />
            </div>
          </div>
          <div>
            <label className="kpi-label mb-1 block">Hipótesis</label>
            <textarea value={form.hypothesis} onChange={(e) => setForm({ ...form, hypothesis: e.target.value })} rows={2} className="input-dark w-full" />
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
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className={`inline-block ${STATUS_BADGE[item.status] || STATUS_BADGE.draft}`}>
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                    <span className={PRIORITY_BADGE[item.priority] || PRIORITY_BADGE.medium}>
                      {item.priority || 'medium'}
                    </span>
                    <span className="badge-gray">{AWARENESS_LABELS[item.awarenessLevel] || 'Sin definir'}</span>
                  </div>
                </div>
                <div className="flex gap-2 ml-2 shrink-0">
                  <button onClick={() => handleEdit(item)} className="text-[11px] text-gray-500 hover:text-gray-300 transition">Editar</button>
                  <button onClick={() => handleDelete(item._id)} className="text-[11px] text-gray-500 hover:text-red-400 transition">Eliminar</button>
                </div>
              </div>
              {item.description && (
                <p className="mt-2 text-[12px] text-gray-500 leading-relaxed">{item.description}</p>
              )}
              <div className="mt-3 grid grid-cols-1 gap-1.5 text-[11px] text-app-secondary">
                {item.avatar && <p><strong className="text-app-primary">Avatar:</strong> {item.avatar}</p>}
                {item.angle && <p><strong className="text-app-primary">Ángulo:</strong> {item.angle}</p>}
                {item.territory && <p><strong className="text-app-primary">Territorio:</strong> {item.territory}</p>}
                {item.symptom && <p><strong className="text-app-primary">Síntoma:</strong> {item.symptom}</p>}
                {item.objection && <p><strong className="text-app-primary">Objeción:</strong> {item.objection}</p>}
                {item.recommendedFormat && <p><strong className="text-app-primary">Formato:</strong> {item.recommendedFormat}</p>}
                {item.hypothesis && <p><strong className="text-app-primary">Hipótesis:</strong> {item.hypothesis}</p>}
              </div>
              {(item.tags || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.tags.map((tag) => <span key={tag} className="chip text-[10px] py-0">{tag}</span>)}
                </div>
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
