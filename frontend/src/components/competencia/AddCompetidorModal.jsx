import { useEffect, useState } from 'react';

/**
 * Modal para crear/editar competidor — flujo simplificado.
 *
 * Modo "create" (default): solo Nombre + URL + Notas. AI completa el resto.
 * Modo "edit" + "advancedOpen": expone los campos avanzados (avatar, awareness,
 * posicionamiento, oferta, ángulos/territorios/objeciones manuales).
 */

const AWARENESS_OPTIONS = [
  { value: 'unknown', label: 'Sin definir' },
  { value: 'unaware', label: 'No consciente' },
  { value: 'problem-aware', label: 'Problema' },
  { value: 'solution-aware', label: 'Solución' },
  { value: 'product-aware', label: 'Producto' },
  { value: 'most-aware', label: 'Muy consciente' },
];

const EMPTY = {
  nombre: '',
  url: '',
  positioning: '',
  avatar: '',
  awarenessLevel: 'unknown',
  mainOffer: '',
  angles: '',
  territories: '',
  objectionsDetected: '',
  notas: '',
};

function competitorToForm(c) {
  if (!c) return EMPTY;
  return {
    nombre: c.nombre || '',
    url: c.url || '',
    positioning: c.positioning || '',
    avatar: c.avatar || '',
    awarenessLevel: c.awarenessLevel || 'unknown',
    mainOffer: c.mainOffer || '',
    angles: (c.angles || []).join(', '),
    territories: (c.territories || []).join(', '),
    objectionsDetected: (c.objectionsDetected || []).join(', '),
    notas: c.notas || '',
  };
}

export default function AddCompetidorModal({ open, onClose, onSubmit, competitor }) {
  const isEdit = !!competitor;
  const [form, setForm] = useState(EMPTY);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(competitorToForm(competitor));
    setAdvancedOpen(isEdit);
  }, [open, competitor, isEdit]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setSubmitting(true);
    const payload = {
      ...form,
      angles: form.angles.split(',').map((s) => s.trim()).filter(Boolean),
      territories: form.territories.split(',').map((s) => s.trim()).filter(Boolean),
      objectionsDetected: form.objectionsDetected.split(',').map((s) => s.trim()).filter(Boolean),
    };
    try {
      await onSubmit?.(payload);
    } finally {
      setSubmitting(false);
    }
  };

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-6 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-[#131316] border border-white/[0.08] rounded-2xl max-w-[680px] w-full max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start px-7 py-5 border-b border-white/[0.06] sticky top-0 bg-[#131316] z-10">
          <div>
            <p className="text-[18px] font-bold text-white">
              {isEdit ? 'Editar competidor' : 'Agregar competidor'}
            </p>
            <p className="text-[12.5px] text-gray-300 mt-1">
              {isEdit
                ? 'Modificá los datos cargados. El próximo análisis usa la URL actualizada.'
                : 'Solo necesitás nombre y URL — el resto lo completa el análisis con AI.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-white/[0.04] border border-white/[0.08] w-8 h-8 rounded-full text-white text-[16px] hover:bg-white/[0.1] transition flex-shrink-0"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 py-6 space-y-5">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Nombre *</label>
            <input
              type="text"
              required
              value={form.nombre}
              onChange={update('nombre')}
              placeholder="Ej: Stock Center"
              className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[14px] text-white placeholder:text-gray-400 outline-none focus:border-blue-500/40"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">URL del sitio</label>
            <input
              type="text"
              value={form.url}
              onChange={update('url')}
              placeholder="stockcenter.com.ar"
              className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[14px] text-white placeholder:text-gray-400 outline-none focus:border-blue-500/40"
            />
            <p className="text-[11px] text-gray-400 mt-1.5">Necesaria para que el análisis con AI funcione.</p>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Notas</label>
            <textarea
              rows={3}
              value={form.notas}
              onChange={update('notas')}
              placeholder="Algo específico que querés recordar de este competidor..."
              className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[14px] text-white placeholder:text-gray-400 outline-none focus:border-blue-500/40 resize-none"
            />
          </div>

          {/* Avanzado */}
          <div className="pt-3 border-t border-white/[0.05]">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="text-[11.5px] text-gray-300 hover:text-white font-medium inline-flex items-center gap-1.5"
            >
              <svg
                className={`w-3 h-3 transition-transform ${advancedOpen ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
              Campos avanzados (opcionales — si querés cargarlos a mano)
            </button>

            {advancedOpen && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Posicionamiento</label>
                    <input
                      type="text"
                      value={form.positioning}
                      onChange={update('positioning')}
                      placeholder="Ej: Marketplace de marcas premium"
                      className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-white outline-none focus:border-blue-500/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Awareness target</label>
                    <select
                      value={form.awarenessLevel}
                      onChange={update('awarenessLevel')}
                      className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-white outline-none focus:border-blue-500/40"
                    >
                      {AWARENESS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Avatar</label>
                    <input
                      type="text"
                      value={form.avatar}
                      onChange={update('avatar')}
                      placeholder="Ej: Deportista amateur 18-35"
                      className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-white outline-none focus:border-blue-500/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Oferta principal</label>
                    <input
                      type="text"
                      value={form.mainOffer}
                      onChange={update('mainOffer')}
                      placeholder="Ej: 3 cuotas sin interés + envío gratis"
                      className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-white outline-none focus:border-blue-500/40"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Ángulos (separados por coma)</label>
                  <input
                    type="text"
                    value={form.angles}
                    onChange={update('angles')}
                    placeholder="precio, autoridad, transformación"
                    className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-white outline-none focus:border-blue-500/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Territorios (separados por coma)</label>
                  <input
                    type="text"
                    value={form.territories}
                    onChange={update('territories')}
                    placeholder="confianza, urgencia, estilo"
                    className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-white outline-none focus:border-blue-500/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Objeciones detectadas (separadas por coma)</label>
                  <input
                    type="text"
                    value={form.objectionsDetected}
                    onChange={update('objectionsDetected')}
                    placeholder="precio, calidad, entrega"
                    className="mt-1.5 w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5 text-[13px] text-white outline-none focus:border-blue-500/40"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-white/[0.05]">
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
              {submitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Agregar competidor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
