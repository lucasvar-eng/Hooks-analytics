/**
 * Card individual de un anuncio en la galería de Creativos.
 * Visual-first: thumbnail grande arriba, métricas overlay, tier badge,
 * checkbox de selección para comparador.
 */

const TIER_BADGE = {
  A: { bg: 'rgba(16,185,129,0.92)', color: '#fff' },
  B: { bg: 'rgba(59,130,246,0.92)', color: '#fff' },
  C: { bg: 'rgba(251,191,36,0.92)', color: '#000' },
  D: { bg: 'rgba(249,115,22,0.92)', color: '#fff' },
  E: { bg: 'rgba(239,68,68,0.92)', color: '#fff' },
};

function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '$0';
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
function fmtPct(v, digits = 1) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(digits)}%`;
}
function fmtMultiple(v, digits = 2) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(digits)}x`;
}

function roasTone(v) {
  if (!v || v <= 0) return null;
  if (v >= 2.5) return 'good';
  if (v >= 1.5) return 'warn';
  return 'bad';
}

function ctrTone(v) {
  if (!v || v <= 0) return null;
  if (v >= 1.5) return 'good';
  if (v >= 0.5) return 'warn';
  return 'bad';
}

const TONE_TEXT = {
  good: '#6ee7b7',
  warn: '#fcd34d',
  bad: '#fca5a5',
};

export default function AdGalleryCard({ ad, selected = false, onToggleSelect, onClick }) {
  const m = ad.metrics || {};
  const spend = Number(m.spend || 0);
  const purchases = Number(m.purchases || 0);
  const roas = Number(m.roas || 0);
  const ctr = Number(m.ctr || 0);
  const cpa = Number(m.cpa || 0);
  const tier = ad.tier || 'E';
  const isBleeding = spend > 0 && purchases === 0;
  const tierStyle = TIER_BADGE[tier] || TIER_BADGE.E;

  const adsetLabel = ad.parentName || ad.parentId || '';

  return (
    <div
      onClick={() => onClick?.(ad)}
      className={`relative rounded-xl border overflow-hidden bg-[#161618] cursor-pointer transition-all duration-200 group ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-500/30'
          : 'border-white/[0.06] hover:border-white/[0.18] hover:-translate-y-0.5'
      }`}
      style={{ boxShadow: selected ? '0 12px 32px rgba(59,130,246,0.18)' : undefined }}
    >
      {/* Checkbox de selección */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleSelect?.(ad); }}
        className={`absolute top-2.5 left-2.5 z-10 w-6 h-6 rounded border-[1.5px] backdrop-blur flex items-center justify-center text-[14px] font-bold transition ${
          selected
            ? 'bg-blue-500 border-blue-500 text-white'
            : 'bg-black/60 border-white/40 text-transparent hover:border-white/80'
        }`}
        aria-label={selected ? 'Deseleccionar' : 'Seleccionar'}
      >
        ✓
      </button>

      {/* Tier badge */}
      <span
        className="absolute top-2.5 right-2.5 z-10 px-2 py-0.5 rounded text-[11px] font-bold backdrop-blur"
        style={{ background: tierStyle.bg, color: tierStyle.color }}
      >
        {tier}
      </span>

      {/* Thumbnail */}
      <div
        className="relative aspect-[4/5] w-full bg-[#0a0a0a] overflow-hidden"
        style={ad.thumbnailUrl ? {
          backgroundImage: `url(${ad.thumbnailUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      >
        {!ad.thumbnailUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-app-muted text-[11px] uppercase tracking-wider">
            Sin preview
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.85))',
        }} />

        {/* Métricas overlay */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-[2] flex flex-wrap gap-1.5">
          {spend > 0 ? (
            <>
              <MetricBadge label="ROAS" value={fmtMultiple(roas)} tone={roasTone(roas)} />
              <MetricBadge label="CTR" value={fmtPct(ctr, 1)} tone={ctrTone(ctr)} />
              {purchases > 0 ? (
                <MetricBadge label="CPA" value={fmtMoneyShort(cpa)} />
              ) : (
                <MetricBadge label="SANGRA" value={fmtMoneyShort(spend)} tone="bad" />
              )}
            </>
          ) : (
            <MetricBadge label="Sin spend en el período" />
          )}
        </div>

        {isBleeding && (
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-[2] px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/90 text-white">
            ⚠ Sangrando
          </div>
        )}
      </div>

      {/* Meta debajo */}
      <div className="p-3.5">
        <p
          className="text-[12.5px] text-white font-medium leading-snug overflow-hidden"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
          title={ad.nombre}
        >
          {ad.nombre || ad.creativeName || 'Sin nombre'}
        </p>
        <div className="flex items-center justify-between mt-2 gap-2">
          <span className="text-[10.5px] text-app-muted truncate">
            {ad.status === 'ACTIVE' ? 'Activo' : ad.status === 'PAUSED' ? 'Pausado' : ad.status?.toLowerCase() || '—'}
            {adsetLabel && ` · ${adsetLabel}`}
          </span>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: ad.status === 'ACTIVE' ? '#34d399' : '#fbbf24' }}
          />
        </div>
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/[0.04] text-[11px]">
          <span className="text-app-muted">Gasto <span className="text-app-secondary tabular-nums font-medium ml-1">{spend > 0 ? fmtMoneyShort(spend) : '—'}</span></span>
          <span className="text-app-muted">Compras <span className="text-app-secondary tabular-nums font-medium ml-1">{purchases || '—'}</span></span>
        </div>
      </div>
    </div>
  );
}

function MetricBadge({ label, value, tone }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] backdrop-blur"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <span className="text-app-muted text-[9px] uppercase tracking-wider">{label}</span>
      <span className="font-bold tabular-nums" style={{ color: tone ? TONE_TEXT[tone] : '#fff' }}>{value}</span>
    </span>
  );
}
