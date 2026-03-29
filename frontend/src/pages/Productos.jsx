import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';

function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function ProductProfileModal({ storeId, product, onClose }) {
  const [profile, setProfile] = useState(null);
  const [sim, setSim] = useState(null);
  const [simInputs, setSimInputs] = useState({
    precio: product.precio,
    costoUnitario: product.costoUnitario,
    costoEmpaque: product.costoEmpaque || 0,
  });

  useEffect(() => {
    api.get(`/api/stores/${storeId}/products/${product._id}/profile`).then((r) => setProfile(r.data)).catch(() => {});
  }, [storeId, product._id]);

  const handleSimulate = async () => {
    try {
      const { data } = await api.post(`/api/stores/${storeId}/products/${product._id}/simulate`, simInputs);
      setSim(data);
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-4 mb-4">
          {product.imagenUrl && (
            <img src={product.imagenUrl} alt="" className="w-16 h-16 rounded object-cover" />
          )}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{product.nombre}</h3>
            <p className="text-sm text-gray-500">SKU: {product.tnProductId} | Stock: {product.stock}</p>
          </div>
        </div>

        {/* Cost breakdown */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase">Precio</p>
            <p className="text-lg font-bold">{fmt(product.precio)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">COGS</p>
            <p className="text-lg font-bold">{fmt(product.costoUnitario)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Margen Bruto</p>
            <p className={`text-lg font-bold ${(product.margenBrutoPct || 0) > 30 ? 'text-green-600' : 'text-yellow-600'}`}>
              {fmt(product.margenBruto)} ({(product.margenBrutoPct || 0).toFixed(1)}%)
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Ventas 30d</p>
            <p className="text-lg font-bold">{product.ventas30dias}</p>
          </div>
        </div>

        {/* Simulator */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Simulador</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500">Precio</label>
              <input type="number" value={simInputs.precio} onChange={(e) => setSimInputs({ ...simInputs, precio: +e.target.value })} className="w-full mt-1 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
            </div>
            <div>
              <label className="text-xs text-gray-500">COGS</label>
              <input type="number" value={simInputs.costoUnitario} onChange={(e) => setSimInputs({ ...simInputs, costoUnitario: +e.target.value })} className="w-full mt-1 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Empaque</label>
              <input type="number" value={simInputs.costoEmpaque} onChange={(e) => setSimInputs({ ...simInputs, costoEmpaque: +e.target.value })} className="w-full mt-1 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
            </div>
          </div>
          <button onClick={handleSimulate} className="mt-2 px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">Simular</button>
          {sim && (
            <div className="mt-2 text-sm">
              Margen: <span className={`font-bold ${sim.margenBrutoPct > 30 ? 'text-green-600' : 'text-yellow-600'}`}>{fmt(sim.margenBruto)} ({sim.margenBrutoPct.toFixed(1)}%)</span>
            </div>
          )}
        </div>

        {/* Recent orders */}
        {profile?.recentOrders?.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Últimas ventas</h4>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left py-1">Orden</th>
                  <th className="text-left py-1">Cliente</th>
                  <th className="text-right py-1">Cant.</th>
                  <th className="text-right py-1">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {profile.recentOrders.map((o, i) => (
                  <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="py-1">{o.tnOrderNumber}</td>
                    <td className="py-1">{o.customerName}</td>
                    <td className="py-1 text-right">{o.cantidad}</td>
                    <td className="py-1 text-right">{fmt(o.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={onClose} className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          Cerrar
        </button>
      </div>
    </div>
  );
}

function StockBadge({ stock, ventas30dias, ultimaVenta }) {
  if (stock === 0) return <span className="px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700">Sin stock</span>;
  if (stock <= 5) return <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700">Stock bajo</span>;

  // Dead stock check
  if (ventas30dias === 0 && stock > 0) {
    const noSale = !ultimaVenta || (new Date() - new Date(ultimaVenta)) > 90 * 24 * 60 * 60 * 1000;
    if (noSale) return <span className="px-1.5 py-0.5 text-xs rounded bg-gray-200 text-gray-600">Dead stock</span>;
  }

  return null;
}

export default function Productos() {
  const { storeId } = useParams();
  const { from, to } = useSelector((s) => s.date);
  const [data, setData] = useState({ products: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (from) params.from = from;
      if (to) params.to = to;
      const { data: res } = await api.get(`/api/stores/${storeId}/products`, { params });
      setData(res);
    } catch {
      setData({ products: [], total: 0 });
    }
    setLoading(false);
  }, [storeId, from, to, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Cargando productos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Productos ({data.total})
        </h2>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-750">
              {['Producto', 'Precio', 'COGS', 'Margen %', 'Stock', 'Ventas período', 'Revenue período', 'Velocity', 'Días stock', ''].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {data.products.map((p) => (
              <tr key={p._id} className="hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer" onClick={() => setSelected(p)}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {p.imagenUrl && <img src={p.imagenUrl} alt="" className="w-8 h-8 rounded object-cover" />}
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">{p.nombre}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{fmt(p.precio)}</td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{fmt(p.costoUnitario)}</td>
                <td className="px-3 py-2">
                  <span className={`font-medium ${(p.margenBrutoPct || 0) > 30 ? 'text-green-600' : (p.margenBrutoPct || 0) > 15 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {p.margenBrutoPct ? `${p.margenBrutoPct.toFixed(1)}%` : '—'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="text-gray-700 dark:text-gray-300">{p.stock}</span>
                  <StockBadge stock={p.stock} ventas30dias={p.ventas30dias} ultimaVenta={p.ultimaVenta} />
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{p.periodSales || 0}</td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{fmt(p.periodRevenue)}</td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{p.velocity?.toFixed(1) || '—'}</td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{p.diasDeStock || '—'}</td>
                <td className="px-3 py-2 text-gray-400">→</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.total > 50 && (
        <div className="flex justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 text-sm rounded border disabled:opacity-50">Anterior</button>
          <span className="px-3 py-1 text-sm text-gray-500">Pág. {page} de {Math.ceil(data.total / 50)}</span>
          <button disabled={page >= Math.ceil(data.total / 50)} onClick={() => setPage(page + 1)} className="px-3 py-1 text-sm rounded border disabled:opacity-50">Siguiente</button>
        </div>
      )}

      {selected && (
        <ProductProfileModal storeId={storeId} product={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
