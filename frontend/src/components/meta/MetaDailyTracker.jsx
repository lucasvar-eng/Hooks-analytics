import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

const META_METRICS = {
  adSpend: 'Ad Spend',
  impressions: 'Impresiones',
  reach: 'Alcance',
  clicks: 'Clicks',
  ctr: 'CTR',
  cpc: 'CPC',
  cpm: 'CPM',
  metaPurchases: 'Compras',
  metaPurchaseValue: 'Revenue Ads',
  roas: 'ROAS',
  cpa: 'CPA',
  ncCpa: 'NC CPA',
  conversionRate: 'CVR',
};

export default function MetaDailyTracker({ storeId, from, to }) {
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

  if (loading) return <div className="text-center py-8 text-gray-500">Cargando...</div>;

  const metrics = Object.keys(META_METRICS);

  if (days.length === 0) {
    return (
      <p className="text-gray-500 text-sm text-center py-8">
        Sin datos diarios de Meta para el período seleccionado.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-750">
            <th className="px-2 py-2 text-left text-gray-500 uppercase sticky left-0 bg-gray-50 dark:bg-gray-750 z-10">Métrica</th>
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
              <td className="px-2 py-1.5 font-medium text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800 z-10 whitespace-nowrap">
                {META_METRICS[key]}
              </td>
              {days.map((d) => {
                const val = d[key];
                let display;
                if (key === 'roas') display = val ? `${Number(val).toFixed(2)}x` : '—';
                else if (key === 'ctr' || key === 'conversionRate') display = val ? `${Number(val).toFixed(2)}%` : '—';
                else if (['adSpend', 'metaPurchaseValue', 'cpa', 'ncCpa', 'cpc', 'cpm'].includes(key)) display = fmt(val);
                else if (['impressions', 'reach', 'clicks', 'metaPurchases'].includes(key)) display = val ? Number(val).toLocaleString('es-AR') : '—';
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
    </div>
  );
}
