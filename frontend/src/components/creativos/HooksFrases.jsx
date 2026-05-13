import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';

/**
 * Hooks y frases — versión simplificada del LanguageBank embebida en Creativos.
 *
 * Permite cargar y consumir frases comerciales categorizadas:
 *  - Hook: ganchos de apertura
 *  - Objeción: lo que dice el cliente que no compra (con respuesta opcional)
 *  - Frase: cita o testimonio real
 *  - Vocabulario: palabras que usa el avatar
 *
 * Click en una card copia el texto al portapapeles. Filtros por tipo.
 * Form simplificado (sin awareness/avatar/angle del modelo original — opt-in
 * cuando se necesite, no por default).
 *
 * Backend sigue siendo `/api/stores/:id/language-bank`.
 */

const TIPO_OPTIONS = [
  { value: 'hook', label: 'Hook', cls: 'bg-emerald-500/12 text-emerald-300' },
  { value: 'objecion', label: 'Objeción', cls: 'bg-amber-500/12 text-amber-300' },
  { value: 'frase', label: 'Frase', cls: 'bg-blue-500/12 text-blue-300' },
  { value: 'vocabulario', label: 'Vocabulario', cls: 'bg-purple-500/12 text-purple-300' },
];

const TIPO_LABEL = Object.fromEntries(TIPO_OPTIONS.map((t) => [t.value, t.label]));
const TIPO_CLS = Object.fromEntries(TIPO_OPTIONS.map((t) => [t.value, t.cls]));

const FILTERS = [
  { value: '', label: 'Todos' },
  ...TIPO_OPTIONS.map((t) => ({ value: t.value, label: t.label })),
];

export default function HooksFrases({ storeId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tipoFilter, setTipoFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/stores/${storeId}/language-bank`);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const counts = useMemo(() => {
    const c = { '': items.length };
    TIPO_OPTIONS.forEach((t) => { c[t.value] = items.filter((it) => it.tipo === t.value).length; });
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    if (!tipoFilter) return items;
    return items.filter((it) => it.tipo === tipoFilter);
  }, [items, tipoFilter]);

  const handleCopy = async (item) => {
    const text = item.tipo === 'objecion' && item.response
      ? `${item.texto}\n\nRespuesta: ${item.response}`
      : item.texto;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(item._id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Fallback: select text manually
    }
  };

  const handleEdit = (item) => {
    setEditing(item);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta entrada?')) return;
    try {
      await api.delete(`/api/stores/${storeId}/language-bank/${id}`);
      await fetchItems();
    } catch {}
  };

  const handleSubmit = async (payload) => {
    try {
      if (editing) {
        await api.put(`/api/stores/${storeId}/language-bank/${editing._id}`, payload);
      } else {
        await api.post(`/api/stores/${storeId}/language-bank`, payload);
      }
      setModalOpen(false);
      setEditing(null);
      await fetchItems();
    } catch (err) {
      console.error('Error guardando frase:', err);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex justify-between items-start gap-3 mb-4 flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">
            Hooks y frases · Banco de lenguaje
          </p>
          <p className="text-[12.5px] text-gray-200 mt-1 max-w-[560px] leading-snug">
            Frases comerciales reales para reutilizar al armar creativos. Click en una card copia el texto al portapapeles.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/12 text-blue-200 hover:bg-blue-500/20 px-3.5 py-1.5 text-[11.5px] font-semibold transition flex-shrink-0"
        >
          + Agregar frase
        </button>
      </div>

      {/* Filtros */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              type="button"
              onClick={() => setTipoFilter(f.value)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-medium border transition
                ${tipoFilter === f.value
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-200'
                  : 'bg-white/[0.04] border-white/[0.08] text-gray-200 hover:border-white/20 hover:text-white'}`}
            >
              {f.label}
              <span className={`rounded-full px-1.5 py-px text-[10px] font-bold
                ${tipoFilter === f.value ? 'bg-blue-500/25 text-blue-100' : 'bg-white/[0.08] text-gray-200'}`}>
                {counts[f.value] || 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-[13px] text-gray-300 text-center py-6">Cargando...</p>
      ) : items.length === 0 ? (
        <EmptyState onAdd={handleAdd} />
      ) : filtered.length === 0 ? (
        <p className="text-[13px] text-gray-300 text-center py-6">No hay entradas en este filtro.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((item) => (
            <FraseCard
              key={item._id}
              item={item}
              copied={copiedId === item._id}
              onCopy={handleCopy}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <FraseModal
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
      <p className="text-[14px] text-white font-semibold">Sin frases cargadas</p>
      <p className="text-[12.5px] text-gray-300 mt-2 max-w-[520px] mx-auto leading-relaxed">
        Guardá frases que escuchás de clientes (en reviews, WhatsApp, comentarios Meta) y reusalas al redactar creativos.
        Categorizá como <strong className="text-emerald-300">Hook</strong> (gancho), <strong className="text-amber-300">Objeción</strong>, <strong className="text-blue-300">Frase</strong> (testimonio) o <strong className="text-purple-300">Vocabulario</strong>.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-blue-500/35 bg-blue-500/15 text-blue-200 hover:bg-blue-500/25 px-4 py-2 text-[12.5px] font-semibold transition"
      >
        + Agregar primera frase
      </button>
    </div>
  );
}

function FraseCard({ item, copied, onCopy, onEdit, onDelete }) {
  return (
    <div
      className="bg-white/[0.025] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.16] hover:bg-white/[0.04] transition cursor-pointer relative"
      onClick={() => onCopy(item)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${TIPO_CLS[item.tipo] || 'bg-white/[0.06] text-gray-300'}`}>
          {TIPO_LABEL[item.tipo] || item.tipo}
        </span>
        <div className="flex gap-2 flex-shrink-0">
          {copied ? (
            <span className="text-[11px] text-emerald-300 font-semibold">✓ Copiado</span>
          ) : (
            <span className="text-[11px] text-gray-400">Click para copiar</span>
          )}
        </div>
      </div>
      <p className="text-[13.5px] text-white leading-relaxed font-medium">"{item.texto}"</p>
      {item.tipo === 'objecion' && item.response && (
        <p className="mt-2 pl-3 border-l-2 border-emerald-500/40 text-[12.5px] text-gray-200 leading-relaxed italic">
          → {item.response}
        </p>
      )}
      {(item.tags || []).length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {item.tags.map((tag) => (
            <span key={tag} className="bg-white/[0.04] border border-white/[0.06] text-gray-300 px-1.5 py-0.5 rounded-full text-[10px]">
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 pt-2 border-t border-white/[0.04] flex justify-end gap-3" onClick={(e) => e.stopPropagation()}>
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
  );
}

const EMPTY_FORM = {
  tipo: 'hook',
  texto: '',
  response: '',
  tags: '',
};

function itemToForm(item) {
  if (!item) return EMPTY_FORM;
  return {
    tipo: item.tipo || 'hook',
    texto: item.texto || '',
    response: item.response || '',
    tags: (item.tags || []).join(', '),
  };
}

function FraseModal({ item, onClose, onSubmit }) {
  const [form, setForm] = useState(() => itemToForm(item));
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!item;

  useEffect(() => { setForm(itemToForm(item)); }, [item]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.texto.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        tipo: form.tipo,
        texto: form.texto.trim(),
        response: form.response.trim() || undefined,
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
      };
      await onSubmit(payload);
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
              {isEdit ? 'Editar frase' : 'Agregar al banco'}
            </p>
            <p className="text-[12.5px] text-gray-300 mt-1">
              Frases de clientes reales · hooks · objeciones · vocabulario que usás en creativos
            </p>
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
            <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Tipo</label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {TIPO_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, tipo: t.value }))}
                  className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition
                    ${form.tipo === t.value
                      ? 'bg-blue-500/15 border-blue-500/40 text-blue-200'
                      : 'bg-white/[0.04] border-white/[0.08] text-gray-200 hover:border-white/20'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Texto *</label>
            <textarea
              required
              autoFocus
              rows={3}
              value={form.texto}
              onChange={update('texto')}
              placeholder={
                form.tipo === 'hook' ? 'Ej: "¿Cansado de comprar zapatillas que se rompen al mes?"' :
                form.tipo === 'objecion' ? 'Ej: "Está muy caro vs Mercado Libre"' :
                form.tipo === 'frase' ? 'Ej: "Me cambiaron mis entrenamientos" — testimonio real cliente' :
                'Ej: gym hardcore, fitness funcional, lifestyle deportivo'
              }
              className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-white placeholder:text-gray-400 outline-none focus:border-blue-500/40 resize-none"
            />
          </div>

          {form.tipo === 'objecion' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Respuesta sugerida</label>
              <textarea
                rows={2}
                value={form.response}
                onChange={update('response')}
                placeholder='Ej: "Garantía de 1 año + cambio gratis si no te queda — Mercado Libre no te lo da."'
                className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-white placeholder:text-gray-400 outline-none focus:border-blue-500/40 resize-none"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Tags (separados por coma)</label>
            <input
              type="text"
              value={form.tags}
              onChange={update('tags')}
              placeholder="urgencia, descuento, confianza"
              className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-white placeholder:text-gray-400 outline-none focus:border-blue-500/40"
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
              disabled={submitting || !form.texto.trim()}
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
