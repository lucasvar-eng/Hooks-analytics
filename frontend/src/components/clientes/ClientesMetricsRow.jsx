import { useState, useEffect, useMemo, useRef } from 'react';

/**
 * Header "Indicadores" con grid de KPIs configurables para Clientes.
 * Similar a ProductsMetricsRow pero con tooltip ⓘ en cada métrica.
 *
 * Props:
 *   data: objeto pasado a getValue/getSub/getTone de cada métrica
 *   availableMetrics: catálogo
 *   defaultSelected: array de keys
 *   maxSelected: default 4
 *   storageKey: para persistir selección
 *   onOpenGlossary: callback para abrir modal de glosario (opcional)
 */
export default function ClientesMetricsRow({
  title = 'Indicadores',
  subtitle,
  data,
  availableMetrics,
  defaultSelected,
  maxSelected = 4,
  storageKey,
  onOpenGlossary,
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState(() => loadSelected(storageKey, defaultSelected));
  const [draftSelected, setDraftSelected] = useState(selected);

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (editOpen && !wasOpenRef.current) setDraftSelected(selected);
    wasOpenRef.current = editOpen;
  }, [editOpen, selected]);

  const metricsByKey = useMemo(() => {
    const map = new Map();
    availableMetrics.forEach((m) => map.set(m.key, m));
    return map;
  }, [availableMetrics]);

  const visibleMetrics = selected.map((key) => metricsByKey.get(key)).filter(Boolean);

  const toggleDraft = (key) => {
    setDraftSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= maxSelected) return prev;
      return [...prev, key];
    });
  };

  const applyDraft = () => {
    setSelected(draftSelected);
    saveSelected(storageKey, draftSelected);
    setEditOpen(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-baseline px-1 gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">{title}</p>
          {subtitle && <p className="text-[12.5px] text-gray-200 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex gap-2">
          {onOpenGlossary && (
            <button
              type="button"
              onClick={onOpenGlossary}
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 text-[11.5px] font-medium text-blue-200 transition"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" strokeWidth="2" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 17v-5M12 8h.01" />
              </svg>
              Glosario
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] hover:border-white/20 px-3 py-1.5 text-[11.5px] font-medium text-gray-200 hover:text-white transition"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4H4v16h16v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            {editOpen ? 'Cerrar' : 'Editar métricas'}
          </button>
        </div>
      </div>

      {editOpen && (
        <div className="rounded-xl border border-blue-500/25 bg-white/[0.03] p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] font-bold uppercase tracking-[1.2px] text-blue-300">
              Elegí hasta {maxSelected} métricas
            </span>
            <span className="text-[11px] text-gray-300">
              Tocá una opción para activarla / desactivarla
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {availableMetrics.map((m) => {
              const isSelected = draftSelected.includes(m.key);
              const isDisabled = !isSelected && draftSelected.length >= maxSelected;
              return (
                <button
                  type="button"
                  key={m.key}
                  onClick={() => !isDisabled && toggleDraft(m.key)}
                  disabled={isDisabled}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[12.5px] transition
                    ${isSelected
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-200'
                      : 'bg-white/[0.02] border-white/[0.06] text-gray-200 hover:bg-white/[0.04] hover:border-white/[0.12]'}
                    ${isDisabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold flex-shrink-0
                    ${isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-white/20 text-transparent'}`}>
                    ✓
                  </span>
                  <span>{m.defaultLabel}</span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/[0.06]">
            <span className="text-[11.5px] text-gray-300">
              {draftSelected.length} de {maxSelected} seleccionadas
            </span>
            <button
              type="button"
              onClick={applyDraft}
              className="rounded-lg border border-blue-500/30 bg-blue-500/15 hover:bg-blue-500/25 text-blue-200 px-4 py-1.5 text-[11.5px] font-semibold"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {visibleMetrics.map((m) => {
          const value = m.getValue ? m.getValue(data) : '—';
          const sub = m.getSub ? m.getSub(data) : null;
          const tone = m.getTone ? m.getTone(data) : null;
          const isLong = typeof value === 'string' && value.length >= 12;
          return (
            <div key={m.key} className="card p-5 relative">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">
                  {m.defaultLabel}
                </span>
                {m.info && (
                  <span
                    title={m.info}
                    className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-full bg-white/[0.08] text-gray-300 text-[9px] font-bold cursor-help hover:bg-blue-500/20 hover:text-blue-300 transition"
                  >
                    i
                  </span>
                )}
              </div>
              <div className={`font-bold mt-1.5 leading-tight ${TONE_CLASS[tone] || 'text-white'} ${isLong ? 'text-[20px]' : 'text-[28px]'}`}>
                {value}
              </div>
              {sub && <div className="text-[11px] text-gray-300 mt-1">{sub}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TONE_CLASS = {
  good: 'text-emerald-400',
  warn: 'text-amber-400',
  bad: 'text-red-400',
};

function loadSelected(storageKey, defaults) {
  if (!storageKey) return defaults;
  try {
    const raw = localStorage.getItem(`${storageKey}:selected`);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaults;
  } catch {
    return defaults;
  }
}

function saveSelected(storageKey, value) {
  if (!storageKey) return;
  try { localStorage.setItem(`${storageKey}:selected`, JSON.stringify(value)); } catch {}
}
