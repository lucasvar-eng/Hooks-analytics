import StoreCard from './StoreCard';

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
        />
      ))}
    </div>
  );
}
