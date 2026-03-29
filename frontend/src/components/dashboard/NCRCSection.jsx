import MetricValue from '../common/MetricValue';

const NCRC_METRICS = [
  { key: 'ncPct', label: 'NC %', prefix: '', suffix: '%', decimals: 1 },
  { key: 'ncOrdenes', label: 'NC Órdenes', prefix: '', suffix: '', decimals: 0 },
  { key: 'ncRevenue', label: 'NC Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'ncCpa', label: 'NC CPA', prefix: '$', suffix: '', decimals: 0 },
  { key: 'ncRoas', label: 'NC ROAS', prefix: '', suffix: 'x', decimals: 2 },
  { key: 'rcOrdenes', label: 'RC Órdenes', prefix: '', suffix: '', decimals: 0 },
  { key: 'rcRevenue', label: 'RC Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
];

export default function NCRCSection({ current, deltas }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Clientes Nuevos vs Recurrentes
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {NCRC_METRICS.map((m) => (
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
    </div>
  );
}
