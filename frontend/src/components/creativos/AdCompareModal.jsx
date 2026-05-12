/**
 * Modal de comparación de anuncios. Recibe 2-4 ads y los muestra
 * side-by-side: thumbnail, copy completo (title + body + CTA), métricas
 * con highlight automático del ganador en cada métrica clave.
 */

import { useEffect, useMemo } from 'react';

const LETTER = ['A', 'B', 'C', 'D'];
const LETTER_BG = {
  A: '#10b981', B: '#3b82f6', C: '#a855f7', D: '#f59e0b',
};

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}
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

/**
 * Detecta el ganador de cada métrica entre los ads.
 * Las invertidas (CPA: menor es mejor) se manejan aparte.
 */
function findWinners(ads) {
  if (!ads || ads.length < 2) return {};
  const winners = {};
  const get = (a, key) => Number(a.metrics?.[key] || 0);

  // Higher-is-better
  ['roas', 'ctr', 'purchases', 'purchaseValue'].forEach((key) => {
    const idx = ads.reduce((bestIdx, a, i) => (get(a, key) > get(ads[bestIdx], key) ? i : bestIdx), 0);
    if (get(ads[idx], key) > 0) winners[key] = idx;
  });

  // Lower-is-better (sólo entre ads con compras > 0 para CPA)
  const adsWithPurchases = ads.map((a, i) => ({ a, i })).filter(({ a }) => get(a, 'purchases') > 0);
  if (adsWithPurchases.length >= 1) {
    let bestI = adsWithPurchases[0].i;
    for (const { a, i } of adsWithPurchases) {
      if (get(a, 'cpa') < get(ads[bestI], 'cpa')) bestI = i;
    }
    winners.cpa = bestI;
  }

  return winners;
}

function MetricRow({ label, getValue, ads, winners, winnerKey, format = (v) => v, tone }) {
  return ads.map((ad, i) => (
    <MetricCell
      key={`${winnerKey}-${i}`}
      label={i === 0 ? label : null}
      value={format(getValue(ad))}
      isWinner={winners[winnerKey] === i}
      tone={tone}
    />
  ));
}

function MetricCell({ label, value, isWinner, tone }) {
  const color = tone === 'good' ? '#6ee7b7' : tone === 'bad' ? '#fca5a5' : '#e5e5e5';
  return (
    <div
      className={`p-3 ${isWinner ? 'bg-gradient-to-b from-emerald-500/10 to-transparent' : ''}`}
      style={isWinner ? { boxShadow: 'inset 2px 0 0 #10b981' } : undefined}
    >
      {label && (
        <div className="text-[10px] uppercase tracking-[0.14em] text-app-muted font-semibold">
          {label}
          {isWinner && <span className="ml-1 text-amber-300">★</span>}
        </div>
      )}
      <div
        className="text-[15px] font-bold tabular-nums mt-1"
        style={{ color: isWinner ? '#6ee7b7' : color }}
      >
        {value}
      </div>
    </div>
  );
}

export default function AdCompareModal({ ads = [], onClose, onAnalyze }) {
  // Lock scroll del body cuando el modal está abierto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Cerrar con Esc
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const winners = useMemo(() => findWinners(ads), [ads]);

  if (!ads || ads.length < 2) return null;

  const overallWinner = useMemo(() => {
    const counts = {};
    Object.values(winners).forEach((i) => { counts[i] = (counts[i] || 0) + 1; });
    let max = -1, best = null;
    for (const [i, c] of Object.entries(counts)) {
      if (c > max) { max = c; best = Number(i); }
    }
    return { idx: best, count: max };
  }, [winners]);

  const cols = ads.length;
  const gridCols = cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[1400px] max-h-[92vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0f0f12] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header sticky */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-6 py-4 border-b border-white/[0.06] bg-[#0f0f12]">
          <div>
            <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Comparador de creativos</p>
            <h2 className="text-white text-[18px] font-semibold mt-1">Comparando {cols} anuncios</h2>
          </div>
          <div className="flex items-center gap-2">
            {onAnalyze && (
              <button
                onClick={() => onAnalyze(ads.map((a) => a.metaId))}
                className="bg-purple-500/12 text-purple-200 border border-purple-500/25 px-3.5 py-2 rounded-md text-[12px] font-semibold hover:bg-purple-500/20"
              >
                Ver lectura del mensaje
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

        {/* Insight bar — highlights automáticos */}
        {overallWinner.idx != null && overallWinner.count > 0 && (
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <div
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-5 py-4 rounded-xl border border-emerald-500/20"
              style={{ background: 'linear-gradient(90deg, rgba(16,185,129,0.07), rgba(59,130,246,0.04))' }}
            >
              <InsightItem label="Mejor ROAS" winner={ads[winners.roas]} idx={winners.roas} ads={ads} fmt={(a) => fmtMultiple(a.metrics?.roas)} />
              <InsightItem label="Mejor CTR" winner={ads[winners.ctr]} idx={winners.ctr} ads={ads} fmt={(a) => fmtPct(a.metrics?.ctr)} />
              <InsightItem label="Más barato (CPA)" winner={ads[winners.cpa]} idx={winners.cpa} ads={ads} fmt={(a) => fmtMoneyShort(a.metrics?.cpa)} />
              <InsightItem label="Más eficiente" winner={ads[overallWinner.idx]} idx={overallWinner.idx} fmt={() => `Gana en ${overallWinner.count} de ${Object.keys(winners).length}`} subtle />
            </div>
          </div>
        )}

        {/* Grid de comparación */}
        <div className={`grid ${gridCols} gap-px bg-white/[0.05]`}>
          {ads.map((ad, i) => {
            const letter = LETTER[i];
            const letterBg = LETTER_BG[letter];
            const isOverallWinner = overallWinner.idx === i;
            return (
              <div key={ad.metaId || i} className="bg-[#0f0f12] flex flex-col">
                {/* Flag ganador */}
                {isOverallWinner && overallWinner.count > 0 && (
                  <div
                    className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] flex items-center gap-2"
                    style={{
                      background: 'linear-gradient(90deg, rgba(16,185,129,0.20), transparent)',
                      color: '#6ee7b7',
                    }}
                  >
                    ★ Ganador en {overallWinner.count} de {Object.keys(winners).length} métricas
                  </div>
                )}
                {/* Head */}
                <div className="px-4 py-3 flex gap-3 items-start border-b border-white/[0.04]">
                  <span
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md text-[14px] font-bold text-white shrink-0"
                    style={{ background: letterBg }}
                  >
                    {letter}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-white text-[13px] font-semibold leading-snug truncate" title={ad.nombre}>
                      {ad.nombre || ad.creativeName || `Ad ${ad.metaId}`}
                    </h3>
                    <p className="text-app-muted text-[11px] mt-0.5">
                      {ad.status === 'ACTIVE' ? 'Activo' : 'Pausado'} · tier {ad.tier || '—'}
                    </p>
                  </div>
                </div>

                {/* Thumbnail */}
                <div
                  className="aspect-[4/5] w-full bg-[#0a0a0a]"
                  style={ad.thumbnailUrl ? {
                    backgroundImage: `url(${ad.thumbnailUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  } : undefined}
                >
                  {!ad.thumbnailUrl && (
                    <div className="h-full flex items-center justify-center text-app-muted text-[11px] uppercase tracking-wider">
                      Sin preview
                    </div>
                  )}
                </div>

                {/* Copy */}
                <div className="p-4 border-b border-white/[0.04]">
                  {ad.creativeTitle && (
                    <>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-app-muted font-semibold">Headline</p>
                      <p className="text-white text-[14px] font-semibold leading-snug mt-1 mb-3">{ad.creativeTitle}</p>
                    </>
                  )}
                  {ad.creativeBody ? (
                    <>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-app-muted font-semibold">Body</p>
                      <p
                        className="text-[12px] text-app-secondary leading-relaxed mt-1 p-3 rounded-md whitespace-pre-wrap border-l-2"
                        style={{ background: 'rgba(255,255,255,0.025)', borderLeftColor: letterBg + '60' }}
                      >
                        {ad.creativeBody}
                      </p>
                    </>
                  ) : (
                    <p className="text-app-muted text-[12px] italic">Sin copy capturado en el sync.</p>
                  )}
                </div>

                {/* Métricas en grid */}
                <div className="grid grid-cols-2 gap-px bg-white/[0.05] mt-auto">
                  <MetricCell label="ROAS" value={Number(ad.metrics?.spend || 0) > 0 ? fmtMultiple(ad.metrics?.roas) : '—'} isWinner={winners.roas === i} />
                  <MetricCell label="CTR" value={Number(ad.metrics?.impressions || 0) > 0 ? fmtPct(ad.metrics?.ctr) : '—'} isWinner={winners.ctr === i} />
                  <MetricCell label="CPA" value={Number(ad.metrics?.purchases || 0) > 0 ? fmtMoneyShort(ad.metrics?.cpa) : '—'} isWinner={winners.cpa === i} />
                  <MetricCell label="Compras" value={Number(ad.metrics?.purchases || 0) || '—'} isWinner={winners.purchases === i} />
                  <MetricCell label="Gasto" value={Number(ad.metrics?.spend || 0) > 0 ? fmtMoneyShort(ad.metrics?.spend) : '—'} />
                  <MetricCell label="Impresiones" value={Number(ad.metrics?.impressions || 0) > 0 ? Number(ad.metrics?.impressions).toLocaleString('es-AR') : '—'} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function InsightItem({ label, winner, idx, ads, fmt, subtle }) {
  if (winner == null && idx == null) return <div />;
  const letter = LETTER[idx];
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-app-muted font-semibold">{label}</p>
      <div className="flex items-baseline gap-2 mt-1.5">
        <span className="text-amber-300 text-[12px]">★</span>
        <span className="text-white text-[13px] font-bold">Anuncio {letter}</span>
      </div>
      {fmt && winner && (
        <p className={`text-[11px] mt-1 tabular-nums ${subtle ? 'text-app-secondary' : 'text-emerald-300'}`}>
          {fmt(winner)}
        </p>
      )}
    </div>
  );
}
