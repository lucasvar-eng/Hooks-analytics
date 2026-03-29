import MetricValue from '../common/MetricValue';

const KPI_CARDS = [
  { key: 'ordenesPositivas', label: 'Órdenes >$0', prefix: '', suffix: '', decimals: 0 },
  { key: 'revenue', label: 'Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'adSpend', label: 'Ad Spend', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'netRevenue', label: 'Net Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'profit', label: 'Profit', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'profitMargin', label: 'Profit Margin', prefix: '', suffix: '%', decimals: 1 },
  { key: 'roas', label: 'ROAS', prefix: '', suffix: 'x', decimals: 2 },
  { key: 'trueRoas', label: 'True ROAS', prefix: '', suffix: 'x', decimals: 2 },
];

export default function KPITopBar({ current, deltas }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {KPI_CARDS.map((kpi) => (
        <div
          key={kpi.key}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
        >
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
