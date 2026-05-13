import { useEffect, useState } from 'react';
import { renderMarkdown } from '../../utils/markdown';

/**
 * Modal de detalle del competidor: análisis AI completo en markdown,
 * datos cargados, oportunidades parseadas, acciones (analizar, editar, eliminar).
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

export default function CompetidorDetailModal({
  competitor,
  onClose,
  onAnalyze,
  onOpportunities,
  onEdit,
  onDelete,
  analyzing,
}) {
  const [opportunityState, setOpportunityState] = useState({ data: null, loading: false });

  useEffect(() => {
    if (!competitor) return;
    setOpportunityState({ data: null, loading: false });
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [competitor, onClose]);

  if (!competitor) return null;

  const c = competitor;
  const hasUrl = !!c.url;
  const isAnalyzed = !!c.analysisResult;

  const handleOpportunities = async () => {
    if (!onOpportunities) return;
    setOpportunityState({ data: null, loading: true });
    try {
      const data = await onOpportunities(c);
      setOpportunityState({ data, loading: false });
    } catch {
      setOpportunityState({ data: null, loading: false });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-6 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-[#131316] border border-white/[0.08] rounded-2xl max-w-[860px] w-full max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 px-7 py-5 border-b border-white/[0.06] sticky top-0 bg-[#131316] z-10">
          <span className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] text-gray-200 text-[16px] font-bold inline-flex items-center justify-center flex-shrink-0">
            {initialsOf(c.nombre)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[18px] font-bold text-white">{c.nombre}</p>
            {hasUrl ? (
              <a
                href={c.url.startsWith('http') ? c.url : `https://${c.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12.5px] text-gray-300 hover:text-blue-300 inline-flex items-center gap-1 mt-1"
              >
                {hostnameOf(c.url)} ↗
              </a>
            ) : (
              <p className="text-[12.5px] text-gray-300 italic mt-1">Sin URL</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-white/[0.04] border border-white/[0.08] w-8 h-8 rounded-full text-white text-[16px] hover:bg-white/[0.1] transition flex-shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="px-7 py-6 space-y-6">
          {/* Datos cargados */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300 mb-3">Datos cargados</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                ['Avatar', c.avatar],
                ['Awareness target', AWARENESS_LABELS[c.awarenessLevel]],
                ['Posicionamiento', c.positioning],
                ['Oferta principal', c.mainOffer],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-white/[0.025] border border-white/[0.06] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-gray-300">{label}</p>
                  <p className="text-[13px] text-gray-100 mt-1 leading-snug">{value || <span className="text-gray-400 italic">Sin cargar</span>}</p>
                </div>
              ))}
            </div>
            {(c.angles?.length > 0 || c.territories?.length > 0 || c.objectionsDetected?.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(c.angles || []).map((a) => (
                  <span key={`a-${a}`} className="bg-white/[0.04] border border-white/[0.08] text-gray-200 px-2.5 py-1 rounded-full text-[11px]">
                    {a}
                  </span>
                ))}
                {(c.territories || []).map((t) => (
                  <span key={`t-${t}`} className="bg-white/[0.04] border border-white/[0.08] text-gray-200 px-2.5 py-1 rounded-full text-[11px]">
                    {t}
                  </span>
                ))}
                {(c.objectionsDetected || []).map((o) => (
                  <span key={`o-${o}`} className="bg-amber-500/[0.06] border border-amber-500/15 text-amber-200 px-2.5 py-1 rounded-full text-[11px]">
                    Objeción: {o}
                  </span>
                ))}
              </div>
            )}
            {c.notas && (
              <div className="mt-3 rounded-lg bg-white/[0.025] border border-white/[0.06] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-gray-300">Notas</p>
                <p className="text-[13px] text-gray-100 mt-1 leading-relaxed">{c.notas}</p>
              </div>
            )}
          </div>

          {/* Análisis AI */}
          <div>
            <div className="flex justify-between items-baseline gap-3 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Análisis con AI</p>
              {c.lastAnalysis && (
                <p className="text-[11px] text-gray-300">
                  Última corrida: {new Date(c.lastAnalysis).toLocaleDateString('es-AR')}
                </p>
              )}
            </div>

            {isAnalyzed ? (
              <div className="rounded-xl bg-blue-500/[0.04] border border-blue-500/15 p-5">
                <div
                  className="markdown-body text-[13.5px] text-gray-100 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(c.analysisResult) }}
                />
              </div>
            ) : (
              <div className="rounded-xl bg-white/[0.02] border border-dashed border-white/[0.1] p-6 text-center">
                <p className="text-[13px] text-gray-200 max-w-[420px] mx-auto leading-relaxed">
                  {hasUrl
                    ? 'Todavía no hay análisis. Ejecutá "Analizar con AI" para que la IA navegue el sitio y devuelva oferta, ángulos, posicionamiento y oportunidades.'
                    : 'Agregá la URL del sitio para habilitar el análisis con AI.'}
                </p>
              </div>
            )}
          </div>

          {/* Oportunidades (botón → llamada al endpoint) */}
          {isAnalyzed && (
            <div>
              <div className="flex justify-between items-baseline gap-3 mb-3">
                <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Oportunidades focalizadas</p>
                <button
                  type="button"
                  onClick={handleOpportunities}
                  disabled={opportunityState.loading}
                  className="text-[11.5px] font-semibold py-1.5 px-3.5 rounded-full bg-emerald-500/12 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50"
                >
                  {opportunityState.loading ? 'Pensando...' : 'Generar oportunidades'}
                </button>
              </div>
              {opportunityState.data?.opportunities?.length > 0 ? (
                <div className="space-y-2">
                  {opportunityState.data.opportunities.map((item, i) => (
                    <div key={i} className="rounded-lg bg-emerald-500/[0.03] border-l-2 border-emerald-500/40 px-4 py-3">
                      <p className="text-[13px] font-semibold text-white">{item.title}</p>
                      {item.gap && <p className="text-[12.5px] text-gray-200 mt-1">{item.gap}</p>}
                      {item.action && <p className="text-[12.5px] text-emerald-300 mt-1.5">→ {item.action}</p>}
                    </div>
                  ))}
                  {opportunityState.data?.confidence != null && (
                    <p className="text-[11px] text-gray-300 mt-2">
                      Confianza: {(opportunityState.data.confidence * 100).toFixed(0)}%
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[12.5px] text-gray-300">
                  Hacé click en "Generar oportunidades" para que AI proponga 3-5 acciones concretas comparando a este competidor con tu tienda.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer acciones */}
        <div className="px-7 py-4 border-t border-white/[0.06] flex justify-between gap-2 flex-wrap sticky bottom-0 bg-[#131316]">
          <button
            type="button"
            onClick={() => onDelete?.(c)}
            className="text-[12px] text-gray-400 hover:text-red-300 transition"
          >
            Eliminar competidor
          </button>
          <div className="flex gap-2">
            {hasUrl && (
              <button
                type="button"
                onClick={() => onAnalyze?.(c)}
                disabled={analyzing}
                className="bg-emerald-500/12 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 px-4 py-2 rounded-lg text-[12.5px] font-medium disabled:opacity-50"
              >
                {analyzing ? 'Analizando...' : isAnalyzed ? 'Re-analizar' : 'Analizar con AI'}
              </button>
            )}
            <button
              type="button"
              onClick={() => onEdit?.(c)}
              className="bg-blue-500/12 border border-blue-500/30 text-blue-200 hover:bg-blue-500/20 px-4 py-2 rounded-lg text-[12.5px] font-medium"
            >
              Editar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
