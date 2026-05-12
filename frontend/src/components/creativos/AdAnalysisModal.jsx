/**
 * Modal con el detalle del análisis IA de uno o varios anuncios.
 * Muestra los tags clasificadores (ángulo, tono, CTA, target) + el rationale
 * de Claude (por qué funciona o no). Si el análisis no existe, ofrece dispararlo.
 */

import { useEffect } from 'react';

const ANGLE_EMOJI = {
  'producto-urgencia': '⚡',
  'social-proof': '👥',
  'descuento-general': '🏷️',
  'educativo': '📚',
  'transformacion': '🎯',
  'generico-marca': '💬',
  'otro': '·',
};

function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '$0';
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
function fmtPct(v, digits = 2) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(digits)}%`;
}
function fmtMultiple(v, digits = 2) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(digits)}x`;
}

export default function AdAnalysisModal({ ads = [], analyses = {}, onClose, onAnalyze, analyzing = false, error = null }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!ads || ads.length === 0) return null;

  const adsWithCopy = ads.filter((a) => a.creativeBody || a.creativeTitle);
  const missingAnalysisIds = adsWithCopy
    .filter((a) => !analyses[a.metaId])
    .map((a) => a.metaId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[1100px] max-h-[92vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0f0f12] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-6 py-4 border-b border-white/[0.06] bg-[#0f0f12]">
          <div>
            <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">★ Análisis IA del mensaje</p>
            <h2 className="text-white text-[18px] font-semibold mt-1">
              {ads.length === 1 ? 'Detalle del anuncio' : `${ads.length} anuncios analizados`}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {missingAnalysisIds.length > 0 && onAnalyze && (
              <button
                onClick={() => onAnalyze(missingAnalysisIds)}
                disabled={analyzing}
                className="bg-purple-500/15 text-purple-200 border border-purple-500/30 px-3.5 py-2 rounded-md text-[12px] font-semibold hover:bg-purple-500/25 disabled:opacity-50"
              >
                {analyzing ? 'Analizando...' : `Analizar ${missingAnalysisIds.length} faltantes`}
              </button>
            )}
            <button
              onClick={onClose}
              className="bg-transparent text-app-secondary border border-white/[0.12] px-3 py-2 rounded-md text-[12px] hover:text-white"
            >
              Cerrar (Esc)
            </button>
          </div>
        </div>

        {error && (
          <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/20 text-red-300 text-[12.5px]">
            {error}
          </div>
        )}

        {/* Lista de ads */}
        <div className="divide-y divide-white/[0.05]">
          {ads.map((ad) => (
            <AdAnalysisRow key={ad.metaId} ad={ad} analysis={analyses[ad.metaId]} analyzing={analyzing} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AdAnalysisRow({ ad, analysis, analyzing }) {
  const m = ad.metrics || {};
  const hasCopy = ad.creativeBody || ad.creativeTitle;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[200px,1fr,260px] gap-5 p-6">
      {/* Thumbnail + meta */}
      <div>
        <div
          className="aspect-[4/5] w-full rounded-lg bg-[#0a0a0a] mb-2"
          style={ad.thumbnailUrl ? {
            backgroundImage: `url(${ad.thumbnailUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          } : undefined}
        >
          {!ad.thumbnailUrl && (
            <div className="h-full flex items-center justify-center text-app-muted text-[11px]">Sin preview</div>
          )}
        </div>
        <p className="text-white text-[13px] font-semibold leading-snug">{ad.nombre || 'Sin nombre'}</p>
        <p className="text-app-muted text-[11px] mt-1">
          {ad.status === 'ACTIVE' ? '● Activo' : '● Pausado'} · tier {ad.tier || '—'}
        </p>
      </div>

      {/* Copy + análisis */}
      <div>
        {hasCopy ? (
          <>
            {ad.creativeTitle && (
              <>
                <p className="text-[10px] uppercase tracking-[0.14em] text-app-muted font-semibold">Headline</p>
                <p className="text-white text-[14px] font-semibold leading-snug mt-1 mb-3">{ad.creativeTitle}</p>
              </>
            )}
            {ad.creativeBody && (
              <>
                <p className="text-[10px] uppercase tracking-[0.14em] text-app-muted font-semibold">Body original</p>
                <p
                  className="text-[12.5px] text-app-secondary leading-relaxed mt-1 p-3 rounded-md whitespace-pre-wrap border-l-2 border-emerald-500/40"
                  style={{ background: 'rgba(255,255,255,0.025)' }}
                >
                  {ad.creativeBody}
                </p>
              </>
            )}

            {analysis ? (
              <>
                {/* Tags */}
                <div className="flex flex-wrap gap-2 mt-4">
                  <Tag color="emerald" icon={ANGLE_EMOJI[analysis.angle] || '·'} label="Ángulo" value={analysis.angleLabel} />
                  {analysis.tone && <Tag color="blue" icon="📣" label="Tono" value={analysis.tone} />}
                  {analysis.cta && <Tag color="purple" icon="→" label="CTA" value={analysis.cta} />}
                  {analysis.target && <Tag color="amber" icon="🎯" label="Target" value={analysis.target} />}
                </div>
                {analysis.hook && (
                  <p className="text-[12px] text-app-secondary mt-3">
                    <span className="text-app-muted">Hook detectado: </span>
                    <span className="text-white">"{analysis.hook}"</span>
                  </p>
                )}
                {analysis.valueProposition && (
                  <p className="text-[12px] text-app-secondary mt-1">
                    <span className="text-app-muted">Promesa: </span>
                    <span className="text-white">{analysis.valueProposition}</span>
                  </p>
                )}
                {/* Rationale */}
                {analysis.rationale && (
                  <div
                    className="mt-4 p-4 rounded-lg border-l-[3px] border-purple-500"
                    style={{ background: 'linear-gradient(90deg, rgba(168,85,247,0.10), transparent)' }}
                  >
                    <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-purple-300">★ IA · por qué funciona o no</p>
                    <p className="text-[12.5px] text-white leading-relaxed mt-2">{analysis.rationale}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-4 p-4 rounded-lg border border-dashed border-white/[0.1] text-center">
                <p className="text-app-muted text-[12px]">
                  {analyzing ? 'Claude analizando...' : 'Este ad todavía no fue analizado. Tocá "Analizar faltantes" arriba.'}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="p-4 rounded-lg bg-white/[0.025] text-center">
            <p className="text-app-muted text-[12px] italic">Sin copy capturado en el sync — no se puede analizar.</p>
          </div>
        )}
      </div>

      {/* Performance */}
      <div className="p-4 rounded-lg bg-[#0f0f12] border border-white/[0.05] h-fit">
        <p className="text-[10px] uppercase tracking-[0.14em] text-app-muted font-semibold mb-3">Performance</p>
        <Row label="ROAS" value={Number(m.spend || 0) > 0 ? fmtMultiple(m.roas) : '—'} accent={Number(m.roas) >= 2 ? '#6ee7b7' : Number(m.roas) >= 1 ? '#fcd34d' : '#fca5a5'} />
        <Row label="CTR" value={Number(m.impressions || 0) > 0 ? fmtPct(m.ctr) : '—'} />
        <Row label="CPA" value={Number(m.purchases || 0) > 0 ? fmtMoneyShort(m.cpa) : '—'} />
        <Row label="Compras" value={Number(m.purchases || 0) || '—'} />
        <Row label="Spend" value={Number(m.spend || 0) > 0 ? fmtMoneyShort(m.spend) : '—'} />
        <Row label="Impresiones" value={Number(m.impressions || 0) > 0 ? Number(m.impressions).toLocaleString('es-AR') : '—'} />
      </div>
    </div>
  );
}

function Tag({ color, icon, label, value }) {
  const styles = {
    emerald: 'bg-emerald-500/13 text-emerald-300',
    blue: 'bg-blue-500/13 text-blue-300',
    purple: 'bg-purple-500/13 text-purple-300',
    amber: 'bg-amber-500/13 text-amber-300',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11.5px] font-medium ${styles[color] || styles.emerald}`}>
      <span>{icon}</span>
      <span className="text-app-muted text-[10px]">{label}:</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function Row({ label, value, accent }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-white/[0.04] last:border-0 text-[12px]">
      <span className="text-app-muted">{label}</span>
      <span className="font-bold tabular-nums" style={{ color: accent || '#fff' }}>{value}</span>
    </div>
  );
}
