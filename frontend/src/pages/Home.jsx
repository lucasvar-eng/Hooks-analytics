import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchStores, fetchStoreMetrics } from '../store/storeSlice';
import Header from '../components/common/Header';
import StoreGrid from '../components/home/StoreGrid';
import AddStoreModal from '../components/home/AddStoreModal';

export default function Home() {
  const dispatch = useDispatch();
  const { stores, metrics, loading } = useSelector((state) => state.stores);
  const { from, to } = useSelector((state) => state.date);
  const [showAddModal, setShowAddModal] = useState(false);

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
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva tienda
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Cargando...</div>
        ) : (
          <StoreGrid stores={stores} metrics={metrics} onAddStore={() => setShowAddModal(true)} />
        )}

      </main>

      {showAddModal && (
        <AddStoreModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            dispatch(fetchStores());
          }}
        />
      )}
    </div>
  );
}
