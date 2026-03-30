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

  if (loading) return <div className="text-center py-12 text-[13px] text-gray-600">Cargando tracker...</div>;

  const metrics = Object.keys(METRIC_LABELS);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Daily Tracker</h1>
        <p className="page-subtitle">Métricas diarias del período seleccionado.</p>
      </div>

      <div className="card overflow-x-auto">
        {days.length === 0 ? (
          <p className="text-[13px] text-gray-600 text-center py-8">
            Sin datos diarios para el período seleccionado. El tracker se llena automáticamente con cada sync.
          </p>
        ) : (
          <table className="w-full table-dark">
            <thead>
              <tr>
                <th className="text-left sticky left-0 bg-[#161616]">Métrica</th>
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
                  <td className="font-medium text-gray-300 sticky left-0 bg-[#161616]">
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
                      <td key={d.date || d._id} className="text-center tabular-nums">
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