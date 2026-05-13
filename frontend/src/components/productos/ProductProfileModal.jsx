import { useState, useEffect } from 'react';
import api from '../../services/api';

/**
 * Modal de detalle de producto · drill-down al hacer click en una fila de la tabla.
 * Extraído de pages/Productos.jsx (sin cambios funcionales, solo contraste mejorado).
 *
 * Trae:
 *   - GET  /products/:productId/profile  → últimas ventas
 *   - POST /products/:productId/simulate → simulador de margen
 */
function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

export default function ProductProfileModal({ storeId, product, onClose }) {
  const [profile, setProfile] = useState(null);
  const [sim, setSim] = useState(null);
  const [simInputs, setSimInputs] = useState({
    precio: product.precio,
    costoUnitario: product.costoUnitario,
    costoEmpaque: product.costoEmpaque || 0,
  });

  useEffect(() => {
    api.get(`/api/stores/${storeId}/products/${product._id}/profile`)
      .then((r) => setProfile(r.data))
      .catch(() => {});
  }, [storeId, product._id]);

  const handleSimulate = async () => {
    try {
      const { data } = await api.post(`/api/stores/${storeId}/products/${product._id}/simulate`, simInputs);
      setSim(data);
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-[#161616] border border-white/[0.08] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-5">
          {product.imagenUrl && (
            <img src={product.imagenUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />
          )}
          <div>
            <h3 className="text-[15px] font-bold text-white">{product.nombre}</h3>
            <p className="text-[11px] text-gray-200 mt-0.5">
              ID: {product.tnProductId} · SKU: {product.sku || '—'} · Stock: {product.stock}
            </p>
            <p className="text-[11px] text-gray-200 mt-0.5">
              {product.categoria || 'Sin categoría'}{product.subcategoria ? ` · ${product.subcategoria}` : ''}
            </p>
          </div>
        </div>

        {/* Cost breakdown */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          {[
            { label: 'Precio', value: fmt(product.precio), color: '' },
            { label: 'COGS', value: fmt(product.costoUnitario), color: '' },
            {
              label: 'Margen Bruto',
              value: `${fmt(product.margenBruto)} (${(product.margenBrutoPct || 0).toFixed(1)}%)`,
              color: (product.margenBrutoPct || 0) > 30 ? 'text-emerald-400' : 'text-amber-400',
            },
            { label: 'Ventas 30d', value: product.ventas30dias || product.periodSales || 0, color: '' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
              <p className="text-[10px] font-bold text-gray-200 uppercase tracking-wider">{label}</p>
              <p className={`text-[18px] font-bold mt-1 ${color || 'text-white'}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Simulator */}
        <div className="border-t border-white/[0.06] pt-4 mb-5">
          <p className="text-[11px] font-bold text-gray-200 uppercase tracking-wider mb-3">Simulador</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Precio', key: 'precio' },
              { label: 'COGS', key: 'costoUnitario' },
              { label: 'Empaque', key: 'costoEmpaque' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="text-[10px] font-bold text-gray-200 uppercase tracking-wider">{label}</label>
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
            <p className="mt-2 text-[12px] text-gray-100">
              Margen: <span className={`font-bold ${sim.margenBrutoPct > 30 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {fmt(sim.margenBruto)} ({sim.margenBrutoPct.toFixed(1)}%)
              </span>
            </p>
          )}
        </div>

        {/* Recent orders */}
        {profile?.recentOrders?.length > 0 && (
          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-[11px] font-bold text-gray-200 uppercase tracking-wider mb-3">Últimas ventas</p>
            <table className="w-full table-dark">
              <thead>
                <tr>
                  <th className="text-left">Orden</th>
                  <th className="text-left">Cliente</th>
                  <th className="text-right">Cant.</th>
                  <th className="text-right">Ingreso neto</th>
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

        {product.productUrl && (
          <a href={product.productUrl} target="_blank" rel="noreferrer"
             className="mt-4 inline-flex text-[12px] text-blue-300 hover:underline">
            Abrir producto en tienda
          </a>
        )}

        <button onClick={onClose} className="mt-5 w-full py-2 text-[12px] text-gray-200 hover:text-white transition">
          Cerrar
        </button>
      </div>
    </div>
  );
}
