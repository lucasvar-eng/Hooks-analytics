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

export default function StoreGrid({ stores, metrics }) {
  if (!stores.length) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          No hay tiendas configuradas.
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
          Creá tu primera tienda para empezar a ver métricas.
        </p>
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
    </div>
  );
}
