import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

/**
 * Hipótesis y ángulos planificados — versión simplificada del TopicMap
 * embebida en Creativos.
 *
 * Foco: registrar qué hipótesis creativas estás probando, en qué estado
 * (testing/scaling/saturated/paused) y la nota de performance. El framework
 * completo (awareness/avatar/objection/symptom) vive en el form avanzado del
 * modal — opt-in.
 *
 * Backend sigue siendo `/api/stores/:id/topic-maps` (mismo endpoint).
 */

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Borrador', cls: 'bg-white/[0.06] text-gray-300' },
  { value: 'active', label: 'Activo', cls: 'bg-emerald-500/15 text-emerald-300' },
  { value: 'paused', label: 'Pausado', cls: 'bg-amber-500/15 text-amber-300' },
];

const STAGE_OPTIONS = [
  { value: 'unknown', label: 'Sin definir' },
  { value: 'testing', label: 'Testing' },
  { value: 'scaling', label: 'Scaling' },
  { value: 'saturated', label: 'Saturado' },
  { value: 'paused', label: 'Pausado' },
];

const STAGE_BADGE = {
  testing: 'bg-blue-500/12 text-blue-200',
  scaling: 'bg-emerald-500/12 text-emerald-200',
  saturated: 'bg-amber-500/12 text-amber-200',
  paused: 'bg-white/[0.06] text-gray-300',
  unknown: 'bg-white/[0.04] text-gray-300',
};

const STAGE_LABEL = {
  testing: 'Testing',
  scaling: 'Scaling',
  saturated: 'Saturado',
  paused: 'Pausado',
  unknown: 'Sin definir',
};

export default function HipotesisAngulos({ storeId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/stores/${storeId}/topic-maps`);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleEdit = (item) => {
    setEditing(item);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta hipótesis?')) return;
    try {
      await api.delete(`/api/stores/${storeId}/topic-maps/${id}`);
      await fetchItems();
    } catch {}
  };

  const handleSubmit = async (payload) => {
    try {
      if (editing) {
        await api.put(`/api/stores/${storeId}/topic-maps/${editing._id}`, payload);
      } else {
        await api.post(`/api/stores/${storeId}/topic-maps`, payload);
      }
      setModalOpen(false);
      setEditing(null);
      await fetchItems();
    } catch (err) {
      console.error('Error guardando hipótesis:', err);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex justify-between items-start gap-3 mb-4 flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">
            Hipótesis y ángulos planificados
          </p>
          <p className="text-[12.5px] text-gray-200 mt-1 max-w-[560px] leading-snug">
            Qué ángulos creativos estás probando, en qué etapa están y qué aprendiste de cada uno. La performance real cruza con la tabla "Performance por ángulo" arriba.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/12 text-blue-200 hover:bg-blue-500/20 px-3.5 py-1.5 text-[11.5px] font-semibold transition flex-shrink-0"
        >
          + Agregar hipótesis
        </button>
      </div>

      {loading ? (
        <p className="text-[13px] text-gray-300 text-center py-6">Cargando...</p>
      ) : items.length === 0 ? (
        <EmptyState onAdd={handleAdd} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((item) => (
            <HipotesisCard
              key={item._id}
              item={item}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <HipotesisModal
          item={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

function EmptyState({ onAdd }) {
  return (
    <div className="text-center py-9 px-6 bg-white/[0.015] border border-dashed border-white/[0.1] rounded-xl">
      <p className="text-[14px] text-white font-semibold">No hay hipótesis registradas</p>
      <p className="text-[12.5px] text-gray-300 mt-2 max-w-[480px] mx-auto leading-relaxed">
        Anotá los ángulos creativos que estás probando para llevar registro del aprendizaje.
        Ej: <em className="text-gray-200">"Ángulo precio sin interés vs autoridad de marca"</em>, hipótesis "<em className="text-gray-200">a este avatar le pesa más el precio</em>", estado <strong className="text-emerald-300">Testing</strong>.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-blue-500/35 bg-blue-500/15 text-blue-200 hover:bg-blue-500/25 px-4 py-2 text-[12.5px] font-semibold transition"
      >
        + Agregar primera hipótesis
      </button>
    </div>
  );
}

function HipotesisCard({ item, onEdit, onDelete }) {
  const statusOpt = STATUS_OPTIONS.find((s) => s.value === item.status) || STATUS_OPTIONS[0];
  const stage = item.stage || 'unknown';

  return (
    <div className="bg-white/[0.025] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.16] transition">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[13.5px] font-semibold text-white leading-tight">{item.nombre}</p>
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="text-[11px] text-gray-400 hover:text-gray-200 transition"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => onDelete(item._id)}
            className="text-[11px] text-gray-400 hover:text-red-300 transition"
          >
            Eliminar
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusOpt.cls}`}>
          {statusOpt.label}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${STAGE_BADGE[stage]}`}>
          {STAGE_LABEL[stage]}
        </span>
        {item.angle && (
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/[0.04] border border-white/[0.08] text-gray-200">
            {item.angle}
          </span>
        )}
      </div>
      {item.hypothesis && (
        <p className="text-[12.5px] text-gray-100 leading-relaxed line-clamp-3">
          {item.hypothesis}
        </p>
      )}
      {item.performanceNotes && (
        <div className="mt-2.5 pt-2.5 border-t border-white/[0.04]">
          <p className="text-[9.5px] font-bold uppercase tracking-[1.2px] text-gray-300 mb-1">Nota de performance</p>
          <p className="text-[12px] text-gray-200 leading-snug line-clamp-2">{item.performanceNotes}</p>
        </div>
      )}
    </div>
  );
}

const EMPTY_FORM = {
  nombre: '',
  status: 'draft',
  stage: 'unknown',
  angle: '',
  hypothesis: '',
  performanceNotes: '',
};

function itemToForm(item) {
  if (!item) return EMPTY_FORM;
  return {
    nombre: item.nombre || '',
    status: item.status || 'draft',
    stage: item.stage || 'unknown',
    angle: item.angle || '',
    hypothesis: item.hypothesis || '',
    performanceNotes: item.performanceNotes || '',
  };
}

function HipotesisModal({ item, onClose, onSubmit }) {
  const [form, setForm] = useState(() => itemToForm(item));
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!item;

  useEffect(() => {
    setForm(itemToForm(item));
  }, [item]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-6 overflow-y-auto" onClick={onClose}>
      <div className="bg-[#131316] border border-white/[0.08] rounded-2xl max-w-[560px] w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start px-7 py-5 border-b border-white/[0.06]">
          <div>
            <p className="text-[17px] font-bold text-white">
              {isEdit ? 'Editar hipótesis' : 'Nueva hipótesis'}
            </p>
            <p className="text-[12.5px] text-gray-300 mt-1">Registrá qué ángulo querés probar y por qué.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-white/[0.04] border border-white/[0.08] w-8 h-8 rounded-full text-white text-[16px] hover:bg-white/[0.1]"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Nombre *</label>
            <input
              required
              autoFocus
              type="text"
              value={form.nombre}
              onChange={update('nombre')}
              placeholder="Ej: Cuotas sin interés vs autoridad de marca"
              className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[14px] text-white placeholder:text-gray-400 outline-none focus:border-blue-500/40"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Estado</label>
              <select
                value={form.status}
                onChange={update('status')}
                className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-white outline-none focus:border-blue-500/40"
              >
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Etapa</label>
              <select
                value={form.stage}
                onChange={update('stage')}
                className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-white outline-none focus:border-blue-500/40"
              >
                {STAGE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Ángulo creativo</label>
            <input
              type="text"
              value={form.angle}
              onChange={update('angle')}
              placeholder="Ej: precio, autoridad, transformación"
              className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-white placeholder:text-gray-400 outline-none focus:border-blue-500/40"
            />
            <p className="text-[11px] text-gray-400 mt-1.5">Una palabra que resuma el ángulo. Conecta con la tabla "Performance por ángulo".</p>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Hipótesis</label>
            <textarea
              rows={3}
              value={form.hypothesis}
              onChange={update('hypothesis')}
              placeholder='Ej: "A este avatar le pesa más el precio que la calidad"'
              className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-white placeholder:text-gray-400 outline-none focus:border-blue-500/40 resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Nota de performance</label>
            <textarea
              rows={2}
              value={form.performanceNotes}
              onChange={update('performanceNotes')}
              placeholder='Ej: "ROAS 2.3x en 7 días, CTR 1.8% — vale escalar"'
              className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-white placeholder:text-gray-400 outline-none focus:border-blue-500/40 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/[0.05]">
            <button
              type="button"
              onClick={onClose}
              className="bg-white/[0.04] border border-white/[0.08] text-gray-200 hover:bg-white/[0.08] hover:text-white px-4 py-2 rounded-lg text-[12.5px] font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !form.nombre.trim()}
              className="bg-blue-500/15 border border-blue-500/35 text-blue-200 hover:bg-blue-500/25 px-4 py-2 rounded-lg text-[12.5px] font-semibold disabled:opacity-50"
            >
              {submitting ? 'Guardando...' : isEdit ? 'Guardar' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
