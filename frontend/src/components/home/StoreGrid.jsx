import StoreCard from './StoreCard';

function getStoreNotes(store, metrics) {
  const notes = [];
  const current = metrics?.current || {};
  const metaAccounts = Array.isArray(store.metaAdAccounts) ? store.metaAdAccounts.filter((item) => item?.id) : [];

  if (!store.integrationStatus?.tiendanube?.connected && !store.integrationStatus?.shopify?.connected) {
    notes.push({ text: 'Tienda no conectada' });
  }
  if (store.plataforma === 'shopify' && store.integrationStatus?.shopify?.connected) {
    notes.push({ text: 'Shopify conectada' });
  }
  if (store.plataforma === 'tiendanube' && store.integrationStatus?.tiendanube?.connected) {
    notes.push({ text: 'Tienda Nube conectada' });
  }
  if (!store.integrationStatus?.metaAds?.connected) {
    notes.push({ text: 'Meta Ads no conectado' });
  } else if (metaAccounts.length > 1) {
    notes.push({ text: `Meta Ads con ${metaAccounts.length} cuentas conectadas` });
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
      className="rounded-xl border-2 border-dashed border-white/[0.08] p-5 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-blue-500/40 hover:bg-blue-500/[0.03] transition min-h-[200px] group"
    >
      <div className="w-12 h-12 rounded-full bg-white/[0.05] flex items-center justify-center group-hover:bg-blue-500/10 transition">
        <svg className="w-6 h-6 text-gray-600 group-hover:text-blue-400 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-[13px] font-medium text-gray-600 group-hover:text-blue-400 transition">
          Agregar tienda
        </p>
        <p className="text-[11px] text-gray-700 mt-1">
          Conectá Tienda Nube, Shopify o cargala manual
        </p>
      </div>
    </button>
  );
}

export default function StoreGrid({ stores, metrics, alertCounts = {}, onAddStore }) {
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
          alertCount={alertCounts[store._id] || 0}
        />
      ))}
      <AddStoreCard onClick={onAddStore} />
    </div>
  );
}
