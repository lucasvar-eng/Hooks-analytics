import MetricValue from '../common/MetricValue';

const COST_METRICS = [
  { key: 'costoProductos', label: 'COGS', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'costoEnvio', label: 'Costo Envío', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'comisionPago', label: 'Comisión Pago', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'comisionCuotas', label: 'Comisión Cuotas', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'impuestosIBB', label: 'IBB', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'feePlataforma', label: 'Fee Plataforma', prefix: '$', suffix: '', decimals: 0, compact: true },
];

export default function CostosSection({ current, deltas }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
      <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Costos
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {COST_METRICS.map((m) => (
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
