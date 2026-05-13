import { useEffect } from 'react';

/**
 * Modal de comparación lado a lado de 2-3 competidores.
 * Muestra columnas con los mismos campos para detectar diferencias rápido.
 *
 * Props:
 *   competitors: array de docs (idealmente 2-3)
 *   onClose
 *   onRemove(c)  · saca uno del comparador
 *   onOpenDetail(c) · navega al detalle
 */

const AWARENESS_LABELS = {
  unaware: 'No consciente',
  'problem-aware': 'Problema',
  'solution-aware': 'Solución',
  'product-aware': 'Producto',
  'most-aware': 'Muy consciente',
  unknown: 'Sin definir',
};

function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function hostnameOf(url) {
  if (!url) return null;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const ROWS = [
  { label: 'URL', get: (c) => hostnameOf(c.url) || <span className="text-gray-400 italic">—</span> },
  { label: 'Oferta principal', get: (c) => c.mainOffer || <span className="text-gray-400 italic">—</span> },
  { label: 'Posicionamiento', get: (c) => c.positioning || <span className="text-gray-400 italic">—</span> },
  { label: 'Avatar', get: (c) => c.avatar || <span className="text-gray-400 italic">—</span> },
  { label: 'Awareness target', get: (c) => AWARENESS_LABELS[c.awarenessLevel] || <span className="text-gray-400 italic">—</span> },
  {
    label: 'Ángulos',
    get: (c) => (c.angles?.length
      ? (
        <div className="flex flex-wrap gap-1">
          {c.angles.map((a) => (
            <span key={a} className="bg-white/[0.05] border border-white/[0.08] text-gray-200 px-2 py-0.5 rounded-full text-[10.5px]">{a}</span>
          ))}
        </div>
      )
      : <span className="text-gray-400 italic">—</span>),
  },
  {
    label: 'Territorios',
    get: (c) => (c.territories?.length
      ? (
        <div className="flex flex-wrap gap-1">
          {c.territories.map((t) => (
            <span key={t} className="bg-white/[0.05] border border-white/[0.08] text-gray-200 px-2 py-0.5 rounded-full text-[10.5px]">{t}</span>
          ))}
        </div>
      )
      : <span className="text-gray-400 italic">—</span>),
  },
  {
    label: 'Objeciones',
    get: (c) => (c.objectionsDetected?.length
      ? (
        <div className="flex flex-wrap gap-1">
          {c.objectionsDetected.map((o) => (
            <span key={o} className="bg-amber-500/[0.06] border border-amber-500/15 text-amber-200 px-2 py-0.5 rounded-full text-[10.5px]">{o}</span>
          ))}
        </div>
      )
      : <span className="text-gray-400 italic">—</span>),
  },
];

export default function CompetidorCompareModal({ competitors, onClose, onRemove, onOpenDetail }) {
  useEffect(() => {
    if (!competitors || competitors.length === 0) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [competitors, onClose]);

  if (!competitors || competitors.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-6 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-[#131316] border border-white/[0.08] rounded-2xl max-w-[1200px] w-full max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start px-7 py-5 border-b border-white/[0.06] sticky top-0 bg-[#131316] z-10">
          <div>
            <p className="text-[18px] font-bold text-white">Comparar competidores</p>
            <p className="text-[12.5px] text-gray-300 mt-1">
              {competitors.length} competidor{competitors.length === 1 ? '' : 'es'} lado a lado
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

        <div className="px-7 py-6 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-bold uppercase tracking-[1.2px] text-gray-300 pb-4 pr-4 w-[140px]"></th>
                {competitors.map((c) => (
                  <th key={c._id} className="text-left pb-4 pr-4 align-top min-w-[240px]">
                    <div className="flex items-start gap-3">
                      <span className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] text-gray-200 text-[13px] font-bold inline-flex items-center justify-center flex-shrink-0">
                        {initialsOf(c.nombre)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => onOpenDetail?.(c)}
                          className="text-[14px] font-bold text-white hover:text-blue-300 transition text-left"
                        >
                          {c.nombre}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove?.(c)}
                          className="block text-[10.5px] text-gray-400 hover:text-red-300 mt-0.5 normal-case tracking-normal"
                        >
                          Quitar de comparación
                        </button>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-t border-white/[0.05]">
                  <td className="py-3 pr-4 align-top text-[10.5px] font-bold uppercase tracking-[1.2px] text-gray-300">
                    {row.label}
                  </td>
                  {competitors.map((c) => (
                    <td key={c._id} className="py-3 pr-4 align-top text-[13px] text-gray-100 leading-relaxed">
                      {row.get(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
