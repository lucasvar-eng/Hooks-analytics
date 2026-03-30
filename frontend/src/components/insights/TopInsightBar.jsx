import { useState, useEffect } from 'react';
import api from '../../services/api';

const SEVERITY_COLORS = {
  critical: 'bg-red-500/10 border-red-500/30 text-red-400',
  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  positive: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  neutral: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  diagnostic: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
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
        <p className="text-[11px] font-bold leading-tight">{insight.titulo}</p>
        {insight.descripcion && (
          <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">{insight.descripcion}</p>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-[11px] opacity-50 hover:opacity-100 shrink-0 transition"
        title="Cerrar"
      >
        ✕
      </button>
    </div>
  );
}