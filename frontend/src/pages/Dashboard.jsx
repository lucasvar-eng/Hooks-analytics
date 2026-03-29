import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';

export default function Dashboard() {
  const { storeId } = useParams();
  const metrics = useSelector((state) => state.stores.metrics[storeId]);
  const current = metrics?.current || {};

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        Dashboard
      </h2>

      {/* KPI cards placeholder — Sprint 2 builds the full 8-card layout */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Órdenes', value: current.ordenesPositivas },
          { label: 'Revenue', value: current.revenue, prefix: '$' },
          { label: 'Net Revenue', value: current.netRevenue, prefix: '$' },
          { label: 'AOV', value: current.aov, prefix: '$' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {kpi.label}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {kpi.prefix || ''}
              {kpi.value != null
                ? kpi.value.toLocaleString('es-AR', { maximumFractionDigits: 0 })
                : '—'}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-gray-500 dark:text-gray-400">
          Dashboard completo se construye en Sprint 2 (8 KPI cards, NC/RC,
          tabla de órdenes, modal de detalle).
        </p>
      </div>
    </div>
  );
}
