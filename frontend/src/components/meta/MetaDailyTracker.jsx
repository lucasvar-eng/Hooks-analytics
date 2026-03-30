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

  if (loading) return <div className="text-center py-8 text-[13px] text-gray-600">Cargando...</div>;

  const metrics = Object.keys(META_METRICS);

  if (days.length === 0) {
    return (
      <p className="text-[13px] text-gray-600 text-center py-8">
        Sin datos diarios de Meta para el período seleccionado.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-[11px] w-full table-dark">
        <thead>
          <tr>
            <th className="text-left sticky left-0 bg-[#161616] z-10">Métrica</th>
            {days.map((d) => (
              <th key={d.date || d._id} className="text-center whitespace-nowrap">
                {new Date(d.date || d._id).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((key) => (
            <tr key={key}>
              <td className="font-medium text-gray-300 sticky left-0 bg-[#161616] z-10 whitespace-nowrap">
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
                  <td key={d.date || d._id} className="text-center">
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
