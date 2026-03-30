import { useState, useEffect } from 'react';
import api from '../../services/api';

const SEVERITY_COLORS = {
  critical: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
  warning: 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400',
  positive: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400',
  neutral: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
  diagnostic: 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400',
};

const SEVERITY_ICONS = {
  critical: '🔴',
  warning: '⚠️',
  positive: '🏆',
  neutral: '💡',
  diagnostic: '📋',
};

export default function TopInsightBar({ storeId }) {
  const [insight, setInsight] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    api.get(`/api/stores/${storeId}/insights/top`)
      .then(({ data }) => { if (data) setInsight(data); })
      .catch(() => {});
  }, [storeId]);

  if (!insight || dismissed) return null;

  const colors = SEVERITY_COLORS[insight.severidad] || SEVERITY_COLORS.warning;
  const icon = SEVERITY_ICONS[insight.severidad] || '⚠️';

  return (
    <div className={`rounded-lg border p-3 mb-4 flex items-start gap-3 ${colors}`}>
      <span className="text-base shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold leading-tight">{insight.titulo}</p>
        {insight.descripcion && (
          <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">{insight.descripcion}</p>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-xs opacity-50 hover:opacity-100 shrink-0"
        title="Cerrar"
      >
        ✕
      </button>
    </div>
  );
}
