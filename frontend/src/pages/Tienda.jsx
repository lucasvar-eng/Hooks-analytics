import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import { getPeriodLabel } from '../components/common/MasterMetricBoard';
import SourceMetricsRow from '../components/resumen/SourceMetricsRow';
import { TIENDA_METRICS, TIENDA_DEFAULTS } from '../components/tienda/tiendaMetricsCatalog';
import DailySalesRevenueChart from '../components/tienda/DailySalesRevenueChart';
import PaymentMethodsChart from '../components/tienda/PaymentMethodsChart';
import ChannelChart from '../components/tienda/ChannelChart';
import AIAnalysisPanel from '../components/common/AIAnalysisPanel';
import ClaudeActionBar from '../components/common/ClaudeActionBar';
import TopInsightBar from '../components/insights/TopInsightBar';

function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function buildTiendaData(summary, ncrc, devoluciones) {
  if (!summary) return null;
  return {
    ...summary,
    ncPct: ncrc?.ncPct,
    ncOrdenes: ncrc?.nc?.ordenes,
    rcOrdenes: ncrc?.rc?.ordenes,
    devolucionesCount: devoluciones?.count,
    devolucionesTotal: devoluciones?.total,
  };
}

function TopCustomersTable({ data, storeId }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white text-[15px] font-semibold">Top clientes del período</h3>
          <p className="text-app-secondary text-[12px] mt-1">Quiénes empujaron más facturación</p>
        </div>
        <Link to={`/store/${storeId}/clientes`} className="text-[12px] text-blue-400 hover:text-blue-300 transition">
          Ver todos →
        </Link>
      </div>
      <table className="w-full table-dark">
        <thead>
          <tr>
            {['Cliente', 'Email', 'Órdenes', 'Revenue'].map((h) => (
              <th key={h} className="text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 5).map((c, i) => (
            <tr key={i}>
              <td className="font-medium text-white">{c.name || '—'}</td>
              <td className="text-[11px]">{c._id}</td>
              <td>{c.ordenes}</td>
              <td className="font-semibold text-white tabular-nums">{fmt(c.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Tienda() {
  const { storeId } = useParams();
  const { from, to, preset } = useSelector((s) => s.date);
  const store = useSelector((state) => state.stores.stores.find((item) => item._id === storeId));
  const coverage = useSelector((state) => state.stores.metrics[storeId]?.costCoverage || null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await api.get(`/api/stores/${storeId}/tienda/breakdown`, { params });
      setData(res.data);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, [storeId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="text-center py-12 text-[13px] text-gray-600">Cargando datos de tienda...</div>;

  return (
    <div className="space-y-5">
      <TopInsightBar storeId={storeId} />

      <SourceMetricsRow
        sourceKey="tn"
        title="Tienda Nube"
        subtitle="Lectura comercial · volumen, monetización y calidad de venta"
        periodLabel={getPeriodLabel(preset, from, to)}
        availableMetrics={TIENDA_METRICS}
        data={buildTiendaData(data?.summary, data?.ncrc, data?.devoluciones)}
        deltas={null}
        coverage={coverage}
        storeId={storeId}
        storageKey={`hooks-tienda-${storeId}`}
        defaultSelected={TIENDA_DEFAULTS}
      />

      <DailySalesRevenueChart data={data?.dailyOrders} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <PaymentMethodsChart data={data?.byMedioPago} />
        <ChannelChart data={data?.byCanal} />
      </div>

      <TopCustomersTable data={data?.topCustomers} storeId={storeId} />

      <div className="card p-5 space-y-4">
        <div>
          <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Análisis asistido</p>
          <p className="text-app-secondary text-[12px] mt-1">Prompts y análisis largos quedan al final para no invadir la lectura principal de tienda.</p>
        </div>
        <ClaudeActionBar storeId={storeId} storeName={store?.nombre} from={from} to={to} mode="dashboard" />
        <AIAnalysisPanel storeId={storeId} section="dashboard" from={from} to={to} />
      </div>
    </div>
  );
}
