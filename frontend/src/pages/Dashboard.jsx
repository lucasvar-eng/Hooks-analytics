import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchStoreMetrics } from '../store/storeSlice';
import WidgetGrid from '../components/widgets/WidgetGrid';
import TopInsightBar from '../components/insights/TopInsightBar';
import AIAnalysisPanel from '../components/common/AIAnalysisPanel';

export default function Dashboard() {
  const { storeId } = useParams();
  const dispatch = useDispatch();
  const metrics = useSelector((state) => state.stores.metrics[storeId]);
  const { from, to } = useSelector((state) => state.date);
  const store = useSelector((state) =>
    state.stores.stores.find((s) => s._id === storeId)
  );

  useEffect(() => {
    if (storeId && from && to) {
      dispatch(fetchStoreMetrics({ storeId, from, to }));
    }
  }, [dispatch, storeId, from, to]);

  return (
    <div className="space-y-5">
      <TopInsightBar storeId={storeId} />

      <WidgetGrid
        storeId={storeId}
        pageId="dashboard"
        metrics={metrics}
        objetivos={store?.objetivos}
        from={from}
        to={to}
      />

      <AIAnalysisPanel storeId={storeId} section="dashboard" from={from} to={to} />
    </div>
  );
}
