import { useNavigate } from 'react-router-dom';
import MetricValue from '../common/MetricValue';

const METRIC_CONFIG = {
  ordenesPositivas: { label: 'Órdenes', prefix: '', suffix: '', decimals: 0 },
  revenue: { label: 'Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
  netRevenue: { label: 'Net Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
  profit: { label: 'Profit', prefix: '$', suffix: '', decimals: 0, compact: true },
  profitMargin: { label: 'Margin', prefix: '', suffix: '%', decimals: 1 },
  aov: { label: 'AOV', prefix: '$', suffix: '', decimals: 0 },
  roas: { label: 'ROAS', prefix: '', suffix: 'x', decimals: 2 },
  trueRoas: { label: 'True ROAS', prefix: '', suffix: 'x', decimals: 2 },
  cpa: { label: 'CPA', prefix: '$', suffix: '', decimals: 0 },
  adSpend: { label: 'Ad Spend', prefix: '$', suffix: '', decimals: 0, compact: true },
  ncPct: { label: 'NC%', prefix: '', suffix: '%', decimals: 1 },
  devoluciones: { label: 'Devoluciones', prefix: '', suffix: '', decimals: 0 },
};

export default function StoreCard({ store, metrics }) {
  const navigate = useNavigate();
  const current = metrics?.current || {};
  const deltas = metrics?.deltas || {};
  const displayMetrics = store.metricasHome || [
    'ordenesPositivas',
    'revenue',
    'trueRoas',
    'profit',
    'ncPct',
  ];

  return (
    <div
      onClick={() => navigate(`/store/${store._id}/dashboard`)}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 cursor-pointer hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 transition group"
    >
      {/* Store name */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition">
          {store.nombre}
        </h3>
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            store.integrationStatus?.tiendanube?.connected
              ? 'bg-green-500'
              : 'bg-gray-300 dark:bg-gray-600'
          }`}
          title={
            store.integrationStatus?.tiendanube?.connected
              ? 'TN conectado'
              : 'TN no conectado'
          }
        />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        {displayMetrics.slice(0, 5).map((key) => {
          const config = METRIC_CONFIG[key] || { label: key };
          return (
            <MetricValue
              key={key}
              label={config.label}
              value={current[key]}
              delta={deltas[key]}
              prefix={config.prefix}
              suffix={config.suffix}
              decimals={config.decimals}
              compact={config.compact}
            />
          );
        })}
      </div>
    </div>
  );
}
