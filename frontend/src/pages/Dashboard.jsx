import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchStoreMetrics } from '../store/storeSlice';
import KPITopBar from '../components/dashboard/KPITopBar';
import TiendaSection from '../components/dashboard/TiendaSection';
import NCRCSection from '../components/dashboard/NCRCSection';
import CostosSection from '../components/dashboard/CostosSection';
import LatestSalesTable from '../components/dashboard/LatestSalesTable';
import OrderDetailModal from '../components/dashboard/OrderDetailModal';
import AIAnalysisPanel from '../components/common/AIAnalysisPanel';
import WidgetGrid from '../components/widgets/WidgetGrid';

export default function Dashboard() {
  const { storeId } = useParams();
  const dispatch = useDispatch();
  const metrics = useSelector((state) => state.stores.metrics[storeId]);
  const { from, to } = useSelector((state) => state.date);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const store = useSelector((state) =>
    state.stores.stores.find((s) => s._id === storeId)
  );
  const current = metrics?.current || {};
  const deltas = metrics?.deltas || {};

  useEffect(() => {
    if (storeId && from && to) {
      dispatch(fetchStoreMetrics({ storeId, from, to }));
    }
  }, [dispatch, storeId, from, to]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
        Dashboard
      </h2>

      {/* 8 KPI Cards */}
      <KPITopBar current={current} deltas={deltas} objetivos={store?.objetivos} />

      {/* Sections grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TiendaSection current={current} deltas={deltas} />
        <NCRCSection current={current} deltas={deltas} />
      </div>

      {/* Marketing Mix placeholder */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Marketing Mix
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Conectar Meta Ads para ver datos de campañas, ROAS por canal y
          distribución de inversión. (Sprint 3)
        </p>
      </div>

      {/* Costos */}
      <CostosSection current={current} deltas={deltas} />

      {/* Últimas ventas */}
      <LatestSalesTable
        storeId={storeId}
        from={from}
        to={to}
        onOrderClick={setSelectedOrder}
      />

      {/* Custom Widgets */}
      <WidgetGrid storeId={storeId} pageId="dashboard" metrics={metrics} />

      {/* AI Analysis */}
      <AIAnalysisPanel storeId={storeId} section="dashboard" from={from} to={to} />

      {/* Order detail modal */}
      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}
