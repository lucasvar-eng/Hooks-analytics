const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-900/10',
    border: 'border-red-500',
    title: 'text-red-600 dark:text-red-400',
  },
  warning: {
    bg: 'bg-orange-50 dark:bg-orange-900/10',
    border: 'border-orange-500',
    title: 'text-orange-600 dark:text-orange-400',
  },
  positive: {
    bg: 'bg-green-50 dark:bg-green-900/10',
    border: 'border-green-500',
    title: 'text-green-600 dark:text-green-400',
  },
  neutral: {
    bg: 'bg-blue-50 dark:bg-blue-900/10',
    border: 'border-blue-500',
    title: 'text-blue-600 dark:text-blue-400',
  },
  diagnostic: {
    bg: 'bg-purple-50 dark:bg-purple-900/10',
    border: 'border-purple-500',
    title: 'text-purple-600 dark:text-purple-400',
  },
  verdict: {
    bg: 'bg-gray-50 dark:bg-gray-800',
    border: 'border-gray-400',
    title: 'text-gray-700 dark:text-gray-300',
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
  ESCALAR: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
  PAUSAR: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
  TESTEAR: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  REVISAR: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  IMPLEMENTAR: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
  MANTENER: 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

const LAYER_STYLES = {
  L1: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  L2: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
  L3: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
};

const LAYER_LABELS = { L1: 'Auto', L2: 'AI', L3: 'Manual' };

export default function InsightCard({ insight, onDismiss, onResolve, compact = false }) {
  const s = SEVERITY_STYLES[insight.severidad] || SEVERITY_STYLES.neutral;

  return (
    <div className={`rounded-lg p-3 border-l-[3px] ${s.bg} ${s.border} mb-2 transition hover:translate-x-0.5`}>
      <div className="flex items-start gap-2 mb-1">
        <span className="text-sm shrink-0 mt-0.5">{SEVERITY_ICONS[insight.severidad] || '💡'}</span>
        <span className={`text-xs font-bold leading-tight flex-1 ${s.title}`}>{insight.titulo}</span>
      </div>

      {insight.descripcion && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed ml-6">{insight.descripcion}</p>
      )}

      {insight.impacto && (
        <p className="text-[10px] text-gray-400 ml-6 mt-1 flex items-center gap-1">
          💰 Impacto estimado: <span className="font-bold text-yellow-600 dark:text-yellow-400">{insight.impacto}</span>
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
          <button onClick={() => onDismiss(insight._id)} className="text-[9px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-auto">
            Descartar
          </button>
        )}
      </div>
    </div>
  );
}

export { VERDICT_BADGES };
