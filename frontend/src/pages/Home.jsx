import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchStores, fetchStoreMetrics } from '../store/storeSlice';
import Header from '../components/common/Header';
import StoreGrid from '../components/home/StoreGrid';

export default function Home() {
  const dispatch = useDispatch();
  const { stores, metrics, loading } = useSelector((state) => state.stores);
  const { from, to } = useSelector((state) => state.date);

  useEffect(() => {
    dispatch(fetchStores());
  }, [dispatch]);

  // Fetch metrics for all stores when date range or stores change
  useEffect(() => {
    if (stores.length > 0) {
      stores.forEach((store) => {
        dispatch(fetchStoreMetrics({ storeId: store._id, from, to }));
      });
    }
  }, [dispatch, stores, from, to]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Tiendas
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Cargando...</div>
        ) : (
          <StoreGrid stores={stores} metrics={metrics} />
        )}
      </main>
    </div>
  );
}
