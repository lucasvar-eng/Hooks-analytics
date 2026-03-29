import StoreCard from './StoreCard';

/**
 * Generate quick notes for a store card.
 * Not tied to the date range — always shows most current/pending info.
 */
function getStoreNotes(store, metrics) {
  const notes = [];
  const current = metrics?.current || {};

  if (!store.integrationStatus?.tiendanube?.connected) {
    notes.push({ text: 'TiendaNube no conectada' });
  }
  if (!store.integrationStatus?.metaAds?.connected) {
    notes.push({ text: 'Meta Ads no conectado' });
  }
  if (current.devoluciones > 0) {
    notes.push({ text: `${current.devoluciones} devoluciones recientes` });
  }
  if (store.objetivos?.kpis?.roasTarget && current.roas) {
    if (current.roas < store.objetivos.kpis.roasTarget) {
      notes.push({
        text: `ROAS debajo del target (${current.roas.toFixed(1)}x vs ${store.objetivos.kpis.roasTarget}x)`,
      });
    }
  }

  return notes;
}

function AddStoreCard({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-5 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition min-h-[200px] group"
    >
      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 transition">
        <svg className="w-6 h-6 text-gray-400 group-hover:text-indigo-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
          Agregar tienda
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Conectá TiendaNube o Meta Ads
        </p>
      </div>
    </button>
  );
}

export default function StoreGrid({ stores, metrics, onAddStore }) {
  if (!stores.length) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AddStoreCard onClick={onAddStore} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {stores.map((store) => (
        <StoreCard
          key={store._id}
          store={store}
          metrics={metrics[store._id]}
          notes={getStoreNotes(store, metrics[store._id])}
        />
      ))}
      <AddStoreCard onClick={onAddStore} />
    </div>
  );
}
