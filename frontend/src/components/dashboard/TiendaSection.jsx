import MetricValue from '../common/MetricValue';

const TIENDA_METRICS = [
  { key: 'ordenes', label: 'Órdenes Totales', prefix: '', suffix: '', decimals: 0 },
  { key: 'ordenesPositivas', label: 'Órdenes >$0', prefix: '', suffix: '', decimals: 0 },
  { key: 'revenue', label: 'Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'netRevenue', label: 'Net Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'aov', label: 'AOV', prefix: '$', suffix: '', decimals: 0 },
  { key: 'aovNeto', label: 'AOV Neto', prefix: '$', suffix: '', decimals: 0 },
  { key: 'devoluciones', label: 'Devoluciones', prefix: '', suffix: '', decimals: 0 },
];

export default function TiendaSection({ current, deltas }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Tienda
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {TIENDA_METRICS.map((m) => (
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
