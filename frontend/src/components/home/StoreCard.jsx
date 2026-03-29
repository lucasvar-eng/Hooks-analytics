import { useNavigate } from 'react-router-dom';
import MetricValue from '../common/MetricValue';

const CARD_METRICS = [
  { key: 'ordenesPositivas', label: 'Ventas', prefix: '', suffix: '', decimals: 0 },
  { key: 'adSpend', label: 'Ad Spend', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'roas', label: 'ROAS', prefix: '', suffix: 'x', decimals: 2 },
  { key: 'cpa', label: 'CPA', prefix: '$', suffix: '', decimals: 0 },
  { key: 'conversionRate', label: 'CVR', prefix: '', suffix: '%', decimals: 2 },
];

function getHealthBadge(current, objetivos) {
  if (!objetivos?.kpis) return { color: 'bg-gray-300 dark:bg-gray-600', label: 'Sin objetivos' };

  const kpis = objetivos.kpis;
  const warn = objetivos.alertThresholds?.warningPct || 10;
  let issues = 0;
  let criticals = 0;

  // Check key KPIs against targets
  if (kpis.roasTarget && current.roas) {
    const pct = ((kpis.roasTarget - current.roas) / kpis.roasTarget) * 100;
    if (pct > warn * 2) criticals++;
    else if (pct > 0) issues++;
  }
  if (kpis.cpaMaximo && current.cpa) {
    if (current.cpa > kpis.cpaMaximo * 1.5) criticals++;
    else if (current.cpa > kpis.cpaMaximo) issues++;
  }
  if (kpis.profitMarginMin && current.profitMargin) {
    if (current.profitMargin < kpis.profitMarginMin * 0.5) criticals++;
    else if (current.profitMargin < kpis.profitMarginMin) issues++;
  }

  if (criticals > 0) return { color: 'bg-red-500', label: 'Crítico' };
  if (issues > 0) return { color: 'bg-yellow-500', label: 'Atención' };
  return { color: 'bg-green-500', label: 'OK' };
}

export default function StoreCard({ store, metrics, notes }) {
  const navigate = useNavigate();
  const current = metrics?.current || {};
  const deltas = metrics?.deltas || {};
  const badge = getHealthBadge(current, store.objetivos);

  return (
    <div
      onClick={() => navigate(`/store/${store._id}/dashboard`)}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 transition group flex flex-col"
    >
      {/* Header: name + health badge */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition truncate">
          {store.nombre}
        </h3>
        <span
          className={`w-3 h-3 rounded-full shrink-0 ${badge.color}`}
          title={badge.label}
        />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {CARD_METRICS.map((m) => (
          <MetricValue
            key={m.key}
            label={m.label}
            value={current[m.key]}
            delta={deltas[m.key]}
            prefix={m.prefix}
            suffix={m.suffix}
            decimals={m.decimals}
            compact={m.compact}
          />
        ))}
      </div>

      {/* Notes — not tied to calendar, shows latest/pending info */}
      {notes && notes.length > 0 && (
        <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700">
          {notes.slice(0, 2).map((note, i) => (
            <p
              key={i}
              className="text-xs text-gray-500 dark:text-gray-400 truncate"
            >
              {note.icon && <span className="mr-1">{note.icon}</span>}
              {note.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
