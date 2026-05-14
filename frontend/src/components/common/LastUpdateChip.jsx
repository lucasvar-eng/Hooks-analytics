import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { fetchStores, fetchStoreMetrics, fetchExecutiveOverview } from '../../store/storeSlice';

function formatRelative(date, now) {
  if (!date) return null;
  const diffMs = now - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 30) return 'hace segundos';
  if (diffSec < 90) return 'hace 1 min';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `hace ${diffD}d`;
}

function getMostRecentSync(store) {
  if (!store) return null;
  const candidates = [
    store.integrationStatus?.tiendanube?.lastSync,
    store.integrationStatus?.shopify?.lastSync,
    store.integrationStatus?.metaAds?.lastSync,
  ].filter(Boolean);
  if (!candidates.length) return null;
  return candidates.reduce((max, current) => {
    return new Date(current) > new Date(max) ? current : max;
  });
}

export default function LastUpdateChip() {
  const dispatch = useDispatch();
  const { storeId: routeStoreId } = useParams();
  const stores = useSelector((state) => state.stores.stores || []);
  const dateRange = useSelector((state) => state.date);
  const [now, setNow] = useState(Date.now());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const activeStore = useMemo(
    () => stores.find((s) => String(s._id) === String(routeStoreId)) || null,
    [stores, routeStoreId]
  );

  const { lastSync, scope } = useMemo(() => {
    if (routeStoreId && activeStore) {
      return { lastSync: getMostRecentSync(activeStore), scope: 'store' };
    }
    const allSyncs = stores
      .map((s) => getMostRecentSync(s))
      .filter(Boolean)
      .map((d) => new Date(d).getTime());
    if (!allSyncs.length) return { lastSync: null, scope: 'all' };
    return { lastSync: new Date(Math.max(...allSyncs)).toISOString(), scope: 'all' };
  }, [stores, activeStore, routeStoreId]);

  const handleRefresh = async () => {
    if (syncing) return;
    setSyncing(true);

    // Snapshot del lastSync actual para detectar el cambio cuando termine el sync background
    const baselineByStore = new Map(
      stores.map((s) => [String(s._id), getMostRecentSync(s)])
    );

    try {
      if (scope === 'store' && activeStore) {
        await api.post(`/api/stores/${activeStore._id}/sync/now`);
      } else {
        await Promise.all(
          stores.map((s) =>
            api.post(`/api/stores/${s._id}/sync/now`).catch(() => null)
          )
        );
      }
    } catch {
      // Si falla el disparo, paramos acá
      setSyncing(false);
      return;
    }

    // Poll cada 6s hasta 2 min máximo; se corta antes si detectamos que el lastSync
    // de la(s) store(s) cambió respecto del baseline (el sync background terminó).
    const POLL_MS = 6_000;
    const MAX_MS = 120_000;
    const startedAt = Date.now();
    let stopped = false;

    while (!stopped && Date.now() - startedAt < MAX_MS) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const action = await dispatch(fetchStores());
      const fresh = Array.isArray(action.payload) ? action.payload : [];
      const relevantIds =
        scope === 'store' && activeStore
          ? [String(activeStore._id)]
          : fresh.map((s) => String(s._id));

      const detectedChange = relevantIds.some((id) => {
        const next = getMostRecentSync(fresh.find((s) => String(s._id) === id));
        const base = baselineByStore.get(id);
        if (!next) return false;
        if (!base) return true;
        return new Date(next).getTime() > new Date(base).getTime();
      });

      if (detectedChange) {
        stopped = true;
        if (dateRange?.from && dateRange?.to) {
          if (scope === 'store' && activeStore) {
            await dispatch(
              fetchStoreMetrics({ storeId: activeStore._id, from: dateRange.from, to: dateRange.to })
            );
          } else {
            await dispatch(fetchExecutiveOverview({ from: dateRange.from, to: dateRange.to }));
          }
        }
      }
    }

    setSyncing(false);
    setNow(Date.now());
  };

  const relative = formatRelative(lastSync, now);
  const label = syncing
    ? 'Sincronizando…'
    : lastSync
      ? `Actualizado ${relative}`
      : 'Sin datos sincronizados';
  const dotClass = syncing
    ? 'bg-blue-400 animate-pulse'
    : lastSync
      ? 'bg-emerald-400'
      : 'bg-gray-600';

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      <span className="text-[11px] text-app-secondary whitespace-nowrap">
        {label}
      </span>
      <button
        onClick={handleRefresh}
        disabled={syncing}
        className="ml-1 rounded p-0.5 text-gray-500 hover:text-white hover:bg-white/[0.06] transition disabled:opacity-50 disabled:cursor-not-allowed"
        title={scope === 'store' ? 'Forzar sincronización de esta tienda' : 'Forzar sincronización de todas las tiendas'}
      >
        <svg
          className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>
    </div>
  );
}
