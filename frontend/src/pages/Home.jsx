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
    <div className="app-shell min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[10px] font-bold text-gray-600 uppercase tracking-[1.5px]">
              Workspace
            </h2>
            <h1 className="text-xl font-bold text-white mt-0.5">Tus Tiendas</h1>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva tienda
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-app-secondary text-sm">Cargando tiendas...</div>
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
