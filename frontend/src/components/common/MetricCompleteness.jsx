import { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

/**
 * Badge "Preliminar" para métricas afectadas por costos faltantes.
 *
 * Props:
 *   coverage: { isPreliminary, components, missing, coveragePct }  // viene del backend
 *   storeId:  para linkear al wizard de carga de costos
 *   size:     'sm' | 'md'
 */
export default function MetricCompleteness({ coverage, storeId, size = 'sm' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
  }, [open]);

  if (!coverage || !coverage.isPreliminary) return null;

  const missingComponents = (coverage.missing || [])
    .map((key) => coverage.components?.[key])
    .filter(Boolean);

  if (missingComponents.length === 0) return null;

  const cls =
    size === 'md'
      ? 'text-[11px] px-2 py-[3px]'
      : 'text-[10px] px-1.5 py-[2px]';

  const tooltip = open
    ? createPortal(
        <div
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-50 w-72 rounded-lg border border-white/10 bg-[#161616] shadow-xl p-3 pointer-events-auto"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <p className="text-[11px] font-bold text-white uppercase tracking-[0.12em] mb-2">
            Faltan cargar
          </p>
          <ul className="space-y-1 mb-3">
            {missingComponents.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-[12px] text-gray-300">
                <span className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0" />
                {c.label}
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-gray-500 mb-2">
            La métrica es un estimado hasta cargar estos costos. Cobertura actual: {coverage.coveragePct}%.
          </p>
          {storeId && (
            <Link
              to={`/store/${storeId}/costos`}
              className="inline-block text-[11px] font-semibold text-blue-400 hover:text-blue-300"
            >
              Ir a Costos →
            </Link>
          )}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-[0.08em] bg-amber-500/12 text-amber-300 border border-amber-500/25 hover:bg-amber-500/20 transition cursor-help ${cls}`}
        aria-label="Métrica preliminar — falta cargar costos"
      >
        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" opacity="0.25" />
          <path d="M11 7h2v6h-2zm0 8h2v2h-2z" />
        </svg>
        Preliminar
      </button>
      {tooltip}
    </>
  );
}
