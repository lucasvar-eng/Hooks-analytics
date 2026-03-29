import MetricValue from '../common/MetricValue';
import HealthBadge from './HealthBadge';

const KPI_CARDS = [
  { key: 'ordenesPositivas', label: 'Órdenes >$0', prefix: '', suffix: '', decimals: 0 },
  { key: 'revenue', label: 'Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'adSpend', label: 'Ad Spend', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'netRevenue', label: 'Net Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'profit', label: 'Profit', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'profitMargin', label: 'Profit Margin', prefix: '', suffix: '%', decimals: 1, targetKey: 'profitMarginMin' },
  { key: 'roas', label: 'ROAS', prefix: '', suffix: 'x', decimals: 2, targetKey: 'roasTarget' },
  { key: 'trueRoas', label: 'True ROAS', prefix: '', suffix: 'x', decimals: 2, targetKey: 'roasTarget' },
];

// CPA is inverse (lower is better)
const CPA_CARD = { key: 'cpa', targetKey: 'cpaMaximo', inverse: true };

export default function KPITopBar({ current, deltas, objetivos }) {
  const kpis = objetivos?.kpis || {};
  const thresholds = objetivos?.alertThresholds || {};

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {KPI_CARDS.map((kpi) => (
        <div
          key={kpi.key}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 relative"
        >
          {kpi.targetKey && kpis[kpi.targetKey] && (
            <div className="absolute top-2 right-2">
              <HealthBadge
                value={current[kpi.key]}
                target={kpis[kpi.targetKey]}
                warningPct={thresholds.warningPct}
                criticalPct={thresholds.criticalPct}
                inverseLogic={kpi.key === CPA_CARD.key}
              />
            </div>
          )}
          <MetricValue
            label={kpi.label}
            value={current[kpi.key]}
            delta={deltas[kpi.key]}
            prefix={kpi.prefix}
            suffix={kpi.suffix}
            decimals={kpi.decimals}
            compact={kpi.compact}
          />
        </div>
      ))}
    </div>
  );
}
