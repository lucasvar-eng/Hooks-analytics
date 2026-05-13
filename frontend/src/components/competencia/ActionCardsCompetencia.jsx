/**
 * Dos cards de acciones recomendadas para Competencia:
 *  - Sin análisis: competidores cargados sin AI ejecutada (CTA: Analizar / Editar).
 *  - Oportunidades hot: top oportunidades extraídas del analysisResult markdown.
 */

function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function fmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('es-AR');
}

function daysSince(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function relativeDays(date) {
  const days = daysSince(date);
  if (days == null) return '—';
  if (days === 0) return 'hoy';
  if (days === 1) return 'hace 1 día';
  return `hace ${days} días`;
}

function hostnameOf(url) {
  if (!url) return null;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function parseOpportunities(markdown) {
  if (!markdown) return [];
  const lines = markdown.split('\n');
  const bullets = [];
  for (const line of lines) {
    const match = line.match(/^[\s]*[-•*]\s+(.+)$/);
    if (match && match[1].trim().length > 12) bullets.push(match[1].trim());
  }
  return bullets;
}

function SinAnalisisCard({ competitors, onAnalyze, onEdit, analyzingId }) {
  const pending = (competitors || []).filter((c) => !c.analysisResult);

  return (
    <div className="card p-6">
      <div className="flex justify-between items-start mb-4 gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.3px] text-gray-300">Sin análisis</p>
          <p className="text-[12.5px] text-gray-200 mt-1 leading-snug max-w-[380px]">
            Competidores cargados que aún no analizaste con AI
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[24px] font-bold text-amber-400 tabular-nums leading-none">{fmtNum(pending.length)}</p>
          <p className="text-[11.5px] text-gray-300 mt-1">pendientes</p>
        </div>
      </div>

      {pending.length === 0 ? (
        <p className="text-center text-[13px] text-gray-200 py-6">Todos los competidores tienen análisis.</p>
      ) : (
        <div>
          {pending.slice(0, 5).map((c, idx) => {
            const isLast = idx === Math.min(pending.length, 5) - 1;
            const hasUrl = !!c.url;
            const isAnalyzing = analyzingId === c._id;
            return (
              <div
                key={c._id}
                className={`flex items-center gap-3.5 py-3 px-2 -mx-2 rounded-md ${isLast ? '' : 'border-b border-white/[0.04]'} hover:bg-white/[0.02]`}
              >
                <span className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.06] text-gray-200 inline-flex items-center justify-center text-[13px] font-bold flex-shrink-0">
                  {initialsOf(c.nombre)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-white font-medium truncate">{c.nombre}</p>
                  <p className="text-[11.5px] text-gray-300 mt-0.5 truncate">
                    Agregado {relativeDays(c.createdAt)}
                    {hasUrl ? ` · ${hostnameOf(c.url)}` : ' · falta URL'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => (hasUrl ? onAnalyze?.(c) : onEdit?.(c))}
                  disabled={isAnalyzing}
                  className="text-[11.5px] font-semibold py-1.5 px-3.5 rounded-full bg-blue-500/12 border border-blue-500/30 text-blue-200 hover:bg-blue-500/20 transition disabled:opacity-50 flex-shrink-0"
                >
                  {isAnalyzing ? '...' : hasUrl ? 'Analizar' : 'Editar'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OportunidadesHotCard({ competitors, onOpenDetail }) {
  // Aplanamos oportunidades preservando origen, tomamos top 6.
  const all = [];
  (competitors || []).forEach((c) => {
    const opps = parseOpportunities(c.analysisResult);
    opps.forEach((text, idx) => {
      all.push({ competitorId: c._id, competitor: c, text, idx });
    });
  });

  const top = all.slice(0, 6);

  return (
    <div className="card p-6">
      <div className="flex justify-between items-start mb-4 gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.3px] text-gray-300">Oportunidades hot</p>
          <p className="text-[12.5px] text-gray-200 mt-1 leading-snug max-w-[380px]">
            Acciones de mayor impacto detectadas a partir del análisis competitivo
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[24px] font-bold text-emerald-400 tabular-nums leading-none">{fmtNum(all.length)}</p>
          <p className="text-[11.5px] text-gray-300 mt-1">en backlog</p>
        </div>
      </div>

      {top.length === 0 ? (
        <p className="text-center text-[13px] text-gray-200 py-6">
          Sin oportunidades aún. Ejecutá <strong className="text-white">Analizar con AI</strong> en algún competidor.
        </p>
      ) : (
        <div>
          {top.map((opp, idx) => {
            const isLast = idx === top.length - 1;
            return (
              <button
                type="button"
                key={`${opp.competitorId}-${opp.idx}`}
                onClick={() => onOpenDetail?.(opp.competitor)}
                className={`w-full flex items-center gap-3.5 text-left py-3 px-2 -mx-2 rounded-md ${isLast ? '' : 'border-b border-white/[0.04]'} hover:bg-white/[0.02]`}
              >
                <span className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.06] text-gray-200 inline-flex items-center justify-center text-[13px] font-bold flex-shrink-0">
                  {initialsOf(opp.competitor.nombre)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-white font-medium leading-snug line-clamp-2">{opp.text}</p>
                  <p className="text-[11.5px] text-gray-300 mt-1">Detectado en {opp.competitor.nombre}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ActionCardsCompetencia({ competitors, onAnalyze, onEdit, onOpenDetail, analyzingId }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SinAnalisisCard
        competitors={competitors}
        onAnalyze={onAnalyze}
        onEdit={onEdit}
        analyzingId={analyzingId}
      />
      <OportunidadesHotCard
        competitors={competitors}
        onOpenDetail={onOpenDetail}
      />
    </div>
  );
}
