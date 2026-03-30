const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500',
    title: 'text-red-400',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500',
    title: 'text-amber-400',
  },
  positive: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500',
    title: 'text-emerald-400',
  },
  neutral: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500',
    title: 'text-blue-400',
  },
  diagnostic: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500',
    title: 'text-purple-400',
  },
  verdict: {
    bg: 'bg-white/[0.03]',
    border: 'border-white/20',
    title: 'text-gray-400',
  },
};

const SEVERITY_ICONS = {
  critical: '🔴',
  warning: '⚠️',
  positive: '🏆',
  neutral: '💡',
  diagnostic: '📋',
  verdict: '🏷️',
};

const VERDICT_BADGES = {
  ESCALAR: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  PAUSAR: 'bg-red-500/10 text-red-400 border-red-500/30',
  TESTEAR: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  REVISAR: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  IMPLEMENTAR: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  MANTENER: 'bg-white/[0.05] text-gray-500 border-white/[0.08]',
};

const LAYER_STYLES = {
  L1: 'bg-white/[0.05] text-gray-500',
  L2: 'bg-blue-500/10 text-blue-400',
  L3: 'bg-white/[0.05] text-gray-500',
};

const LAYER_LABELS = { L1: 'Auto', L2: 'AI', L3: 'Manual' };

export default function InsightCard({ insight, onDismiss, compact = false }) {
  const s = SEVERITY_STYLES[insight.severidad] || SEVERITY_STYLES.neutral;

  return (
    <div className={`rounded-lg p-3 border-l-[3px] ${s.bg} ${s.border} mb-2 transition hover:translate-x-0.5`}>
      <div className="flex items-start gap-2 mb-1">
        <span className="text-sm shrink-0 mt-0.5">{SEVERITY_ICONS[insight.severidad] || '💡'}</span>
        <span className={`text-[11px] font-bold leading-tight flex-1 ${s.title}`}>{insight.titulo}</span>
      </div>

      {insight.descripcion && (
        <p className="text-[11px] text-gray-500 leading-relaxed ml-6">{insight.descripcion}</p>
      )}

      {insight.impacto && (
        <p className="text-[10px] text-gray-600 ml-6 mt-1 flex items-center gap-1">
          💰 Impacto estimado: <span className="font-bold text-amber-400">{insight.impacto}</span>
        </p>
      )}

      <div className="flex items-center gap-1.5 mt-2 ml-6 flex-wrap">
        {insight.layer && (
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${LAYER_STYLES[insight.layer] || LAYER_STYLES.L1}`}>
            {LAYER_LABELS[insight.layer] || insight.layer}
          </span>
        )}
        {insight.verdict && VERDICT_BADGES[insight.verdict] && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${VERDICT_BADGES[insight.verdict]}`}>
            {insight.verdict}
          </span>
        )}
        {!compact && onDismiss && (
          <button onClick={() => onDismiss(insight._id)} className="text-[9px] text-gray-600 hover:text-gray-400 ml-auto transition">
            Descartar
          </button>
        )}
      </div>
    </div>
  );
}

export { VERDICT_BADGES };