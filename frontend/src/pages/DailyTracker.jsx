import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';

function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

const METRIC_LABELS = {
  revenue: 'Revenue',
  ordenes: 'Órdenes',
  netRevenue: 'Net Revenue',
  profit: 'Profit',
  adSpend: 'Ad Spend',
  roas: 'ROAS',
  cpa: 'CPA',
  ncOrdenes: 'NC',
  rcOrdenes: 'RC',
  ncPct: 'NC %',
  aov: 'AOV',
  profitMargin: 'Margen %',
};

export default function DailyTracker() {
  const { storeId } = useParams();
  const { from, to } = useSelector((s) => s.date);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const { data } = await api.get(`/api/stores/${storeId}/daily-metrics`, { params });
      setDays(Array.isArray(data) ? data : []);
    } catch {
      setDays([]);
    }
    setLoading(false);
  }, [storeId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando tracker...</div>;

  const metrics = Object.keys(METRIC_LABELS);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Daily Tracker</h2>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        {days.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">
            Sin datos diarios para el período seleccionado. El tracker se llena automáticamente con cada sync.
          </p>
        ) : (
          <table className="text-xs w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-750">
                <th className="px-2 py-2 text-left text-gray-500 uppercase sticky left-0 bg-gray-50 dark:bg-gray-750">Métrica</th>
                {days.map((d) => (
                  <th key={d.date || d._id} className="px-2 py-2 text-center text-gray-500 whitespace-nowrap">
                    {new Date(d.date || d._id).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {metrics.map((key) => (
                <tr key={key} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  <td className="px-2 py-1.5 font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800">
                    {METRIC_LABELS[key]}
                  </td>
                  {days.map((d) => {
                    const val = d[key];
                    let display;
                    if (key === 'roas') display = val ? `${Number(val).toFixed(2)}x` : '—';
                    else if (key === 'ncPct' || key === 'profitMargin') display = val ? `${Number(val).toFixed(1)}%` : '—';
                    else if (['revenue', 'netRevenue', 'profit', 'adSpend', 'cpa', 'aov'].includes(key)) display = fmt(val);
                    else display = val ?? '—';

                    return (
                      <td key={d.date || d._id} className="px-2 py-1.5 text-center text-gray-700 dark:text-gray-300">
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
