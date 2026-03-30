import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import AIAnalysisPanel from '../components/common/AIAnalysisPanel';

function formatCurrency(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function SummaryCard({ label, value, sub, color = 'text-gray-900 dark:text-white' }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold mt-1 tabular-nums ${color}`}>{formatCurrency(value)}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function ForecastTable({ forecast }) {
  if (!forecast || forecast.length === 0) {
    return (
      <p className="text-[11px] text-gray-400 dark:text-gray-500 py-4 text-center">
        No hay pagos proyectados para las próximas semanas.
      </p>
    );
  }

  // Group by week
  const weeks = {};
  for (const entry of forecast) {
    const key = `${entry._id.year}-W${entry._id.semana}`;
    if (!weeks[key]) weeks[key] = { pendiente: 0, recibido: 0, count: 0 };
    weeks[key][entry._id.estado] = entry.total;
    weeks[key].count += entry.count;
  }

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">Semana</th>
          <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">Pendiente</th>
          <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">Recibido</th>
          <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">Total</th>
          <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">Cuotas</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(weeks).map(([week, data]) => (
          <tr key={week} className="border-b border-gray-100 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
            <td className="px-3 py-2 text-[11px] font-medium text-gray-900 dark:text-white">{week}</td>
            <td className="px-3 py-2 text-right text-[11px] text-yellow-600">{formatCurrency(data.pendiente)}</td>
            <td className="px-3 py-2 text-right text-[11px] text-green-600">{formatCurrency(data.recibido)}</td>
            <td className="px-3 py-2 text-right text-[11px] font-medium text-gray-900 dark:text-white tabular-nums">
              {formatCurrency(data.pendiente + data.recibido)}
            </td>
            <td className="px-3 py-2 text-right text-[11px] text-gray-500">{data.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DailyTable({ daily }) {
  if (!daily || daily.length === 0) {
    return (
      <p className="text-[11px] text-gray-400 dark:text-gray-500 py-4 text-center">
        Sin datos de cashflow para este período.
      </p>
    );
  }

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">Fecha</th>
          <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">Bruto</th>
          <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">Comisiones</th>
          <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">Liquidable</th>
          <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">Recibido</th>
          <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">Pendiente</th>
        </tr>
      </thead>
      <tbody>
        {daily.map((d) => (
          <tr key={d._id} className="border-b border-gray-100 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
            <td className="px-3 py-2 text-[11px] font-medium text-gray-900 dark:text-white">{d._id}</td>
            <td className="px-3 py-2 text-right text-[11px] text-gray-700 dark:text-gray-300">{formatCurrency(d.bruto)}</td>
            <td className="px-3 py-2 text-right text-[11px] text-red-500">{formatCurrency(d.comisiones)}</td>
            <td className="px-3 py-2 text-right text-[11px] text-cyan-600">{formatCurrency(d.liquidable)}</td>
            <td className="px-3 py-2 text-right text-[11px] text-green-600">{formatCurrency(d.recibido)}</td>
            <td className="px-3 py-2 text-right text-[11px] text-yellow-600">{formatCurrency(d.pendiente)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Cashflow() {
  const { storeId } = useParams();
  const { from, to } = useSelector((s) => s.date);
  const [summary, setSummary] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('forecast'); // 'forecast' | 'daily'

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;

      const [summaryRes, forecastRes, dailyRes] = await Promise.all([
        api.get(`/api/stores/${storeId}/cashflow/summary`, { params }),
        api.get(`/api/stores/${storeId}/cashflow/forecast`, { params: { weeks: 4 } }),
        api.get(`/api/stores/${storeId}/cashflow/daily`, { params }),
      ]);

      setSummary(summaryRes.data);
      setForecast(forecastRes.data);
      setDaily(dailyRes.data);
    } catch {
      setSummary(null);
      setForecast([]);
      setDaily([]);
    }
    setLoading(false);
  }, [storeId, from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className="text-center py-12 text-xs text-gray-500 dark:text-gray-500">Cargando cashflow...</div>;
  }

  return (
    <div className="space-y-5">
      <p className="section-label">Cashflow</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Bruto total" value={summary?.totalBruto} />
        <SummaryCard
          label="Total liquidable"
          value={summary?.totalLiquidable}
          color="text-cyan-600"
        />
        <SummaryCard
          label="Recibido"
          value={summary?.recibido}
          sub={`${summary?.entriesRecibidas || 0} cuotas`}
          color="text-green-600"
        />
        <SummaryCard
          label="Pendiente"
          value={summary?.pendiente}
          sub={`${summary?.entriesPendientes || 0} cuotas`}
          color="text-yellow-600"
        />
      </div>

      {/* Comisiones card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Total comisiones</p>
            <p className="text-lg font-bold tabular-nums text-red-500 mt-1">
              {formatCurrency(summary?.totalComisiones)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">% sobre ventas</p>
            <p className="text-base font-bold tabular-nums text-gray-700 dark:text-gray-300 mt-1">
              {summary?.totalBruto
                ? ((summary.totalComisiones / summary.totalBruto) * 100).toFixed(1)
                : 0}
              %
            </p>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('forecast')}
          className={`px-4 py-2 text-[11px] font-semibold rounded-lg transition ${
            tab === 'forecast'
              ? 'bg-cyan-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          Forecast (próximas 4 semanas)
        </button>
        <button
          onClick={() => setTab('daily')}
          className={`px-4 py-2 text-[11px] font-semibold rounded-lg transition ${
            tab === 'daily'
              ? 'bg-cyan-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          Detalle diario
        </button>
      </div>

      {/* Table content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 overflow-x-auto">
        {tab === 'forecast' ? (
          <ForecastTable forecast={forecast} />
        ) : (
          <DailyTable daily={daily} />
        )}
      </div>

      <AIAnalysisPanel storeId={storeId} section="cashflow" from={from} to={to} />
    </div>
  );
}
