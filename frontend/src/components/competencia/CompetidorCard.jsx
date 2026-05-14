/**
 * Card grande de competidor (2 cols en grid del padre).
 * Estructura simplificada según v2 del boceto:
 *  - Header: logo + nombre + URL + badge status
 *  - Oferta principal (texto destacado, sin background)
 *  - 3 atributos clave (Avatar / Awareness / Posicionamiento)
 *  - Ángulos y territorios (lista bullet simple)
 *  - Oportunidades detectadas (top 3 con borde lateral verde)
 *  - Footer: tiempo desde análisis + botones Comparar / Ver detalle
 *
 * Estados:
 *  - Analizado: full layout
 *  - Sin análisis (con URL): empty state + CTA "Analizar con AI"
 *  - Incompleto (sin URL): empty state + CTA "Editar"
 *
 * Props:
 *   competitor: doc completo
 *   selectedForCompare: bool
 *   onToggleCompare: () => void
 *   onAnalyze, onEdit, onDelete, onOpenDetail: callbacks
 *   analyzing: bool (estado loading al analizar)
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

function daysSince(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function relativeDays(date, prefix = 'hace') {
  const days = daysSince(date);
  if (days == null) return '—';
  if (days === 0) return prefix === 'hace' ? 'hoy' : 'hoy';
  if (days === 1) return `${prefix} 1 día`;
  return `${prefix} ${days} días`;
}

function parseTopOpportunities(analysisResult, limit = 3) {
  if (!analysisResult) return [];
  // Heurística: extrae bullets `- texto` o `• texto` o `* texto` del markdown.
  const lines = analysisResult.split('\n');
  const bullets = [];
  for (const line of lines) {
    const match = line.match(/^[\s]*[-•*]\s+(.+)$/);
    if (match && match[1].trim().length > 12) bullets.push(match[1].trim());
    if (bullets.length >= limit) break;
  }
  return bullets;
}

function hostnameOf(url) {
  if (!url) return null;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function CompetidorCard({
  competitor,
  selectedForCompare,
  onToggleCompare,
  onAnalyze,
  onScrape,
  onEdit,
  onDelete,
  onOpenDetail,
  analyzing,
  scraping,
}) {
  const c = competitor;
  const hasUrl = !!c.url;
  const isAnalyzed = !!c.analysisResult;
  const status = !hasUrl ? 'incomplete' : isAnalyzed ? 'analyzed' : 'pending';

  const statusBadge = {
    analyzed: { label: 'Analizado', cls: 'bg-emerald-500/15 text-emerald-300' },
    pending: { label: 'Sin análisis', cls: 'bg-amber-500/15 text-amber-300' },
    incomplete: { label: 'Incompleto', cls: 'bg-white/[0.06] text-gray-300' },
  }[status];

  const opportunities = parseTopOpportunities(c.analysisResult, 3);
  const opportunityCount = parseTopOpportunities(c.analysisResult, 999).length;
  const angles = c.angles || [];
  const territories = c.territories || [];
  const objections = c.objectionsDetected || [];

  return (
    <div
      className={`card p-7 md:p-8 transition cursor-pointer
        ${selectedForCompare ? 'border-blue-500/40 bg-blue-500/[0.03]' : 'hover:border-white/[0.16]'}`}
      onClick={() => onOpenDetail?.(c)}
    >
      {/* HEADER */}
      <div className="flex items-start gap-4 pb-5 border-b border-white/[0.05]">
        <div className="w-14 h-14 rounded-xl bg-white/[0.05] border border-white/[0.08] text-gray-200 text-[20px] font-bold inline-flex items-center justify-center flex-shrink-0">
          {initialsOf(c.nombre)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[18px] font-bold text-white leading-tight">{c.nombre}</p>
          {hasUrl ? (
            <a
              href={c.url.startsWith('http') ? c.url : `https://${c.url}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 mt-1 text-[12.5px] text-gray-300 hover:text-blue-300 transition truncate max-w-[360px]"
            >
              {hostnameOf(c.url)}
              <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </a>
          ) : (
            <p className="mt-1 text-[12.5px] text-gray-300 italic">Sin URL cargada</p>
          )}
        </div>
        <span className={`inline-block px-3 py-1 rounded-full text-[10.5px] font-bold uppercase tracking-wide flex-shrink-0 ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
      </div>

      {/* BODY */}
      <div className="pt-5">
        {status === 'analyzed' && (
          <>
            {/* Oferta */}
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300 mb-2">Oferta principal</p>
              <p className="text-[15px] text-white leading-relaxed">
                {c.mainOffer || c.positioning || 'Sin oferta principal cargada.'}
              </p>
            </div>

            {/* Atributos */}
            <div className="grid grid-cols-3 gap-5 pb-5 border-b border-white/[0.04] mb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Avatar</p>
                <p className="text-[13.5px] text-gray-100 mt-1.5 leading-snug">{c.avatar || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Awareness</p>
                <p className="text-[13.5px] text-gray-100 mt-1.5 leading-snug">{AWARENESS_LABELS[c.awarenessLevel] || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Posicionamiento</p>
                <p className="text-[13.5px] text-gray-100 mt-1.5 leading-snug">{c.positioning || '—'}</p>
              </div>
            </div>

            {/* Ángulos y territorios */}
            {(angles.length > 0 || territories.length > 0 || objections.length > 0) && (
              <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300 mb-2">Ángulos y territorios</p>
                <div className="flex flex-col gap-1">
                  {angles.map((a) => (
                    <p key={`a-${a}`} className="relative pl-4 text-[13px] text-gray-100 leading-relaxed before:content-['·'] before:absolute before:left-1 before:text-gray-400 before:text-[18px] before:leading-none">{a}</p>
                  ))}
                  {territories.map((t) => (
                    <p key={`t-${t}`} className="relative pl-4 text-[13px] text-gray-100 leading-relaxed before:content-['·'] before:absolute before:left-1 before:text-gray-400 before:text-[18px] before:leading-none">{t}</p>
                  ))}
                  {objections.map((o) => (
                    <p key={`o-${o}`} className="relative pl-4 text-[13px] text-gray-200 leading-relaxed before:content-['·'] before:absolute before:left-1 before:text-gray-400 before:text-[18px] before:leading-none">Objeción detectada: {o}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Oportunidades */}
            {opportunities.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300 mb-2">
                  {opportunityCount} oportunidad{opportunityCount === 1 ? '' : 'es'} detectada{opportunityCount === 1 ? '' : 's'}
                </p>
                <div className="flex flex-col gap-2.5">
                  {opportunities.map((op, i) => (
                    <p key={i} className="text-[13.5px] text-gray-100 leading-snug pl-4 py-2.5 pr-3.5 border-l-2 border-emerald-500/40 bg-emerald-500/[0.03] rounded-r-md">
                      {op}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {c.notas && (
              <div className="mt-5 pt-4 border-t border-white/[0.04]">
                <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300 mb-1.5">Notas</p>
                <p className="text-[12.5px] text-gray-200 leading-relaxed">{c.notas}</p>
              </div>
            )}
          </>
        )}

        {status === 'pending' && (
          <div className="text-center py-7 px-4 bg-white/[0.02] border border-dashed border-white/[0.1] rounded-xl">
            <p className="text-[13.5px] text-gray-200 leading-relaxed max-w-[420px] mx-auto">
              Agregado pero todavía no analizado. Ejecutá <strong className="text-white">Analizar con AI</strong> para que extraigamos su oferta, ángulos, posicionamiento y oportunidades automáticamente del sitio.
            </p>
          </div>
        )}

        {status === 'incomplete' && (
          <div className="text-center py-7 px-4 bg-white/[0.02] border border-dashed border-white/[0.1] rounded-xl">
            <p className="text-[13.5px] text-gray-200 leading-relaxed max-w-[420px] mx-auto">
              Falta la URL del sitio. Sin eso no podemos analizar la oferta ni detectar oportunidades. Editá el competidor y agregá el dominio.
            </p>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="mt-6 pt-5 border-t border-white/[0.05] flex items-center justify-between gap-3 flex-wrap">
        <span className="text-[11.5px] text-gray-300">
          {isAnalyzed
            ? `Analizado ${relativeDays(c.lastAnalysis)}`
            : `Agregado ${relativeDays(c.createdAt)}`}
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {status === 'pending' && hasUrl && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onScrape?.(c); }}
                disabled={scraping}
                className="bg-white/[0.04] border border-white/[0.08] text-gray-200 hover:bg-white/[0.08] hover:text-white px-3.5 py-1.5 rounded-lg text-[11.5px] font-medium transition disabled:opacity-50"
              >
                {scraping ? 'Scrapeando...' : 'Scrapear'}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAnalyze?.(c); }}
                disabled={analyzing}
                className="bg-emerald-500/12 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 px-3.5 py-1.5 rounded-lg text-[11.5px] font-medium transition disabled:opacity-50"
              >
                {analyzing ? 'Analizando...' : 'Analizar con AI'}
              </button>
            </>
          )}
          {status === 'incomplete' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit?.(c); }}
              className="bg-blue-500/12 border border-blue-500/30 text-blue-200 hover:bg-blue-500/20 px-3.5 py-1.5 rounded-lg text-[11.5px] font-medium transition"
            >
              Editar
            </button>
          )}
          {status !== 'incomplete' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleCompare?.(c); }}
              className={`px-3.5 py-1.5 rounded-lg text-[11.5px] font-medium transition
                ${selectedForCompare
                  ? 'bg-blue-500/20 border border-blue-500/40 text-blue-100'
                  : 'bg-white/[0.04] border border-white/[0.08] text-gray-200 hover:bg-white/[0.08] hover:text-white'}`}
            >
              {selectedForCompare ? '✓ Para comparar' : 'Comparar'}
            </button>
          )}
          {status !== 'pending' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenDetail?.(c); }}
              className="bg-blue-500/12 border border-blue-500/30 text-blue-200 hover:bg-blue-500/20 px-3.5 py-1.5 rounded-lg text-[11.5px] font-medium transition"
            >
              Ver detalle
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
