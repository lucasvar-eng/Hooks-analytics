import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import { getPeriodLabel } from '../components/common/MasterMetricBoard';
import SourceMetricsRow from '../components/resumen/SourceMetricsRow';
import { TIENDA_METRICS, TIENDA_DEFAULTS } from '../components/tienda/tiendaMetricsCatalog';
import DailySalesRevenueChart from '../components/tienda/DailySalesRevenueChart';
import DailySalesTable from '../components/tienda/DailySalesTable';
import PaymentMethodsChart from '../components/tienda/PaymentMethodsChart';
import ChannelChart from '../components/tienda/ChannelChart';
import TemporalDistributionChart from '../components/tienda/TemporalDistributionChart';
import UtmAttributionTable from '../components/tienda/UtmAttributionTable';
import TopInsightBar from '../components/insights/TopInsightBar';
import SortableLayout from '../components/common/SortableLayout';

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

  const sortableItems = [
    {
      id: 'tn-row',
      label: 'KPIs Tienda Nube',
      node: (
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
      ),
    },
    {
      id: 'daily-chart',
      label: 'Ventas y facturación por día',
      node: <DailySalesRevenueChart data={data?.dailyOrders} />,
    },
    {
      id: 'payment-channel',
      label: 'Medios de pago + Canales',
      node: (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <PaymentMethodsChart data={data?.byMedioPago} byPaymentStatus={data?.byPaymentStatus} />
          <ChannelChart data={data?.byCanal} />
        </div>
      ),
    },
    {
      id: 'temporal-distribution',
      label: 'Distribución temporal',
      node: (
        <TemporalDistributionChart
          byDayOfWeek={data?.byDayOfWeek}
          byHourOfDay={data?.byHourOfDay}
        />
      ),
    },
    {
      id: 'utm-attribution',
      label: 'Atribución UTM',
      node: (
        <UtmAttributionTable
          byUtmSource={data?.byUtmSource}
          byUtmMedium={data?.byUtmMedium}
          byUtmCampaign={data?.byUtmCampaign}
        />
      ),
    },
    {
      id: 'daily-table',
      label: 'Detalle diario',
      node: <DailySalesTable data={data?.dailyOrders} extras={data?.dailyExtras} />,
    },
  ];

  return (
    <div className="space-y-5">
      <TopInsightBar storeId={storeId} />

      <SortableLayout
        items={sortableItems}
        storageKey={`hooks-tienda-layout-${storeId}`}
      />
    </div>
  );
}
