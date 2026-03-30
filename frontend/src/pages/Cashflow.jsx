import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import AIAnalysisPanel from '../components/common/AIAnalysisPanel';

function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function SummaryCard({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="card p-4">
      <p className="kpi-label">{label}</p>
      <p className={`text-[20px] font-bold mt-1.5 tabular-nums leading-none ${color}`}>{fmt(value)}</p>
      {sub && <p className="text-[11px] text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

function ForecastTable({ forecast }) {
  if (!forecast || forecast.length === 0) {
    return <p className="text-[13px] text-gray-600 py-8 text-center">No hay pagos proyectados para las próximas semanas.</p>;
  }

  const weeks = {};
  for (const entry of forecast) {
    const key = `${entry._id.year}-W${entry._id.semana}`;
    if (!weeks[key]) weeks[key] = { pendiente: 0, recibido: 0, count: 0 };
    weeks[key][entry._id.estado] = entry.total;
    weeks[key].count += entry.count;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-dark">
        <thead>
          <tr>
            <th className="text-left">Semana</th>
            <th className="text-right">Pendiente</th>
            <th className="text-right">Recibido</th>
            <th className="text-right">Total</th>
            <th className="text-right">Cuotas</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(weeks).map(([week, data]) => (
            <tr key={week}>
              <td className="font-medium text-white">{week}</td>
              <td className="text-right text-amber-400">{fmt(data.pendiente)}</td>
              <td className="text-right text-emerald-400">{fmt(data.recibido)}</td>
              <td className="text-right font-semibold text-white tabular-nums">{fmt(data.pendiente + data.recibido)}</td>
              <td className="text-right text-gray-500">{data.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DailyTable({ daily }) {
  if (!daily || daily.length === 0) {
    return <p className="text-[13px] text-gray-600 py-8 text-center">Sin datos de cashflow para este período.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-dark">
        <thead>
          <tr>
            <th className="text-left">Fecha</th>
            <th className="text-right">Bruto</th>
            <th className="text-right">Comisiones</th>
            <th className="text-right">Liquidable</th>
            <th className="text-right">Recibido</th>
            <th className="text-right">Pendiente</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d._id}>
              <td className="font-medium text-white">{d._id}</td>
              <td className="text-right tabular-nums">{fmt(d.bruto)}</td>
              <td className="text-right text-red-400 tabular-nums">{fmt(d.comisiones)}</td>
              <td className="text-right text-blue-400 tabular-nums">{fmt(d.liquidable)}</td>
              <td className="text-right text-emerald-400 tabular-nums">{fmt(d.recibido)}</td>
              <td className="text-right text-amber-400 tabular-nums">{fmt(d.pendiente)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Cashflow() {
  const { storeId } = useParams();
  const { from, to } = useSelector((s) => s.date);
  const [summary, setSummary] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('forecast');

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

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="text-center py-12 text-[13px] text-gray-600">Cargando cashflow...</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Cashflow</h1>
        <p className="page-subtitle">Liquidaciones, comisiones y proyección de cobros.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Bruto total" value={summary?.totalBruto} />
        <SummaryCard label="Total liquidable" value={summary?.totalLiquidable} color="text-blue-400" />
        <SummaryCard label="Recibido" value={summary?.recibido} sub={`${summary?.entriesRecibidas || 0} cuotas`} color="text-emerald-400" />
        <SummaryCard label="Pendiente" value={summary?.pendiente} sub={`${summary?.entriesPendientes || 0} cuotas`} color="text-amber-400" />
      </div>

      {/* Comisiones card */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="kpi-label">Total comisiones</p>
            <p className="text-[20px] font-bold tabular-nums text-red-400 mt-1.5 leading-none">{fmt(summary?.totalComisiones)}</p>
          </div>
          <div className="text-right">
            <p className="kpi-label">% sobre ventas</p>
            <p className="text-[20px] font-bold tabular-nums text-white mt-1.5 leading-none">
              {summary?.totalBruto ? ((summary.totalComisiones / summary.totalBruto) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-white/[0.06] pb-0">
        {[
          { key: 'forecast', label: 'Forecast (próximas 4 semanas)' },
          { key: 'daily', label: 'Detalle diario' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition ${
              tab === t.key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {tab === 'forecast' ? <ForecastTable forecast={forecast} /> : <DailyTable daily={daily} />}
      </div>

      <AIAnalysisPanel storeId={storeId} section="cashflow" from={from} to={to} />
    </div>
  );
}