import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchStores, fetchStoreMetrics } from '../store/storeSlice';
import Header from '../components/common/Header';
import StoreGrid from '../components/home/StoreGrid';
import AddStoreModal from '../components/home/AddStoreModal';
import api from '../services/api';

export default function Home() {
  const dispatch = useDispatch();
  const { stores, metrics, loading } = useSelector((state) => state.stores);
  const { from, to } = useSelector((state) => state.date);
  const [showAddModal, setShowAddModal] = useState(false);
  const [alertCounts, setAlertCounts] = useState({});

  useEffect(() => {
    dispatch(fetchStores());
    api.get('/api/alerts/active-counts').then(({ data }) => setAlertCounts(data)).catch(() => {});
  }, [dispatch]);

  useEffect(() => {
    if (stores.length > 0) {
      stores.forEach((store) => {
        dispatch(fetchStoreMetrics({ storeId: store._id, from, to }));
      });
    }
  }, [dispatch, stores, from, to]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Tiendas
          </h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-primary-600 text-white text-[11px] font-semibold rounded-md hover:bg-primary-700 transition flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva tienda
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500 text-sm">Cargando...</div>
        ) : (
          <StoreGrid stores={stores} metrics={metrics} alertCounts={alertCounts} onAddStore={() => setShowAddModal(true)} />
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
