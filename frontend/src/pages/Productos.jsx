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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#161616] border border-white/[0.08] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-4 mb-5">
          {product.imagenUrl && (
            <img src={product.imagenUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />
          )}
          <div>
            <h3 className="text-[15px] font-bold text-white">{product.nombre}</h3>
            <p className="text-[11px] text-gray-600 mt-0.5">SKU: {product.tnProductId} | Stock: {product.stock}</p>
          </div>
        </div>

        {/* Cost breakdown */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          {[
            { label: 'Precio', value: fmt(product.precio), color: '' },
            { label: 'COGS', value: fmt(product.costoUnitario), color: '' },
            { label: 'Margen Bruto', value: `${fmt(product.margenBruto)} (${(product.margenBrutoPct || 0).toFixed(1)}%)`, color: (product.margenBrutoPct || 0) > 30 ? 'text-emerald-400' : 'text-amber-400' },
            { label: 'Ventas 30d', value: product.ventas30dias, color: '' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
              <p className="kpi-label">{label}</p>
              <p className={`text-[18px] font-bold mt-1 ${color || 'text-white'}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Simulator */}
        <div className="border-t border-white/[0.06] pt-4 mb-5">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Simulador</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Precio', key: 'precio' },
              { label: 'COGS', key: 'costoUnitario' },
              { label: 'Empaque', key: 'costoEmpaque' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="kpi-label">{label}</label>
                <input
                  type="number"
                  value={simInputs[key]}
                  onChange={(e) => setSimInputs({ ...simInputs, [key]: +e.target.value })}
                  className="input-dark mt-1 w-full"
                />
              </div>
            ))}
          </div>
          <button onClick={handleSimulate} className="btn-primary mt-3">Simular</button>
          {sim && (
            <p className="mt-2 text-[12px] text-gray-400">
              Margen: <span className={`font-bold ${sim.margenBrutoPct > 30 ? 'text-emerald-400' : 'text-amber-400'}`}>{fmt(sim.margenBruto)} ({sim.margenBrutoPct.toFixed(1)}%)</span>
            </p>
          )}
        </div>

        {/* Recent orders */}
        {profile?.recentOrders?.length > 0 && (
          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Últimas ventas</p>
            <table className="w-full table-dark">
              <thead>
                <tr>
                  <th className="text-left">Orden</th>
                  <th className="text-left">Cliente</th>
                  <th className="text-right">Cant.</th>
                  <th className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {profile.recentOrders.map((o, i) => (
                  <tr key={i}>
                    <td>{o.tnOrderNumber}</td>
                    <td>{o.customerName}</td>
                    <td className="text-right">{o.cantidad}</td>
                    <td className="text-right tabular-nums">{fmt(o.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={onClose} className="mt-5 w-full py-2 text-[12px] text-gray-600 hover:text-gray-400 transition">
          Cerrar
        </button>
      </div>
    </div>
  );
}

function StockBadge({ stock, ventas30dias, ultimaVenta }) {
  if (stock === 0) return <span className="badge-red ml-1.5">Sin stock</span>;
  if (stock <= 5) return <span className="badge-amber ml-1.5">Stock bajo</span>;
  if (ventas30dias === 0 && stock > 0) {
    const noSale = !ultimaVenta || (new Date() - new Date(ultimaVenta)) > 90 * 24 * 60 * 60 * 1000;
    if (noSale) return <span className="badge-gray ml-1.5">Dead stock</span>;
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

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  if (loading) {
    return <div className="text-center py-12 text-[13px] text-gray-600">Cargando productos...</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Productos</h1>
        <p className="page-subtitle">Performance, márgenes y stock de tus {data.total} productos.</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full table-dark">
          <thead>
            <tr>
              {['Producto', 'Precio', 'COGS', 'Margen %', 'Stock', 'Ventas período', 'Revenue período', 'Velocity', 'Días stock', ''].map((h) => (
                <th key={h} className="text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.products.map((p) => (
              <tr key={p._id} className="cursor-pointer" onClick={() => setSelected(p)}>
                <td>
                  <div className="flex items-center gap-2">
                    {p.imagenUrl && <img src={p.imagenUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                    <span className="font-medium text-white truncate max-w-[200px]">{p.nombre}</span>
                  </div>
                </td>
                <td className="tabular-nums">{fmt(p.precio)}</td>
                <td className="tabular-nums">{fmt(p.costoUnitario)}</td>
                <td>
                  <span className={`text-[12px] font-semibold tabular-nums ${(p.margenBrutoPct || 0) > 30 ? 'text-emerald-400' : (p.margenBrutoPct || 0) > 15 ? 'text-amber-400' : 'text-red-400'}`}>
                    {p.margenBrutoPct ? `${p.margenBrutoPct.toFixed(1)}%` : '—'}
                  </span>
                </td>
                <td>
                  <span className="text-gray-300">{p.stock}</span>
                  <StockBadge stock={p.stock} ventas30dias={p.ventas30dias} ultimaVenta={p.ultimaVenta} />
                </td>
                <td className="tabular-nums">{p.periodSales || 0}</td>
                <td className="tabular-nums">{fmt(p.periodRevenue)}</td>
                <td className="tabular-nums">{p.velocity?.toFixed(1) || '—'}</td>
                <td className="tabular-nums">{p.diasDeStock || '—'}</td>
                <td className="text-gray-700">→</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.total > 50 && (
        <div className="flex justify-center items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-ghost text-[12px] py-1.5 px-3 disabled:opacity-40">Anterior</button>
          <span className="text-[12px] text-gray-500">Pág. {page} de {Math.ceil(data.total / 50)}</span>
          <button disabled={page >= Math.ceil(data.total / 50)} onClick={() => setPage(page + 1)} className="btn-ghost text-[12px] py-1.5 px-3 disabled:opacity-40">Siguiente</button>
        </div>
      )}

      {selected && (
        <ProductProfileModal storeId={storeId} product={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}