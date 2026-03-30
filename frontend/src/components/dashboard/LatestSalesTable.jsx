import { useState, useEffect } from 'react';
import api from '../../services/api';

const COLUMNS = [
  { key: 'tnOrderNumber', label: 'ID', format: 'text' },
  { key: 'fechaCreacion', label: 'Fecha', format: 'date' },
  { key: 'customerName', label: 'Cliente', format: 'text' },
  { key: 'totalOrden', label: 'Total', format: 'currency' },
  { key: 'comisionPago', label: 'Com. Pago', format: 'currency' },
  { key: 'impuestosIBB', label: 'IBB', format: 'currency' },
  { key: 'comisionCuotas', label: 'Cuotas', format: 'currency' },
  { key: 'feePlataforma', label: 'Fee', format: 'currency' },
  { key: 'costoEnvio', label: 'Envío', format: 'currency' },
  { key: 'costoProductos', label: 'COGS', format: 'currency' },
  { key: 'totalNeto', label: 'Neto', format: 'currency' },
  { key: 'esClienteNuevo', label: 'NC/RC', format: 'ncrc' },
];

function formatCell(value, format) {
  if (value == null) return '—';
  switch (format) {
    case 'currency':
      return `$${Number(value).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
    case 'date':
      return new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    case 'ncrc':
      return value === true ? 'NC' : value === false ? 'RC' : '—';
    default:
      return String(value);
  }
}

export default function LatestSalesTable({ storeId, from, to, onOrderClick }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    api
      .get(`/api/stores/${storeId}/orders`, { params: { from, to, limit: 50 } })
      .then((res) => setOrders(res.data.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [storeId, from, to]);

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <h3 className="kpi-label">Últimas Ventas</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full table-dark">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={col.format === 'text' || col.format === 'date' || col.format === 'ncrc' ? 'text-left' : 'text-right'}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-[12px] text-gray-600">
                  Cargando...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-[12px] text-gray-600">
                  Sin órdenes en este período
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order._id}
                  onClick={() => onOrderClick?.(order)}
                  className="cursor-pointer"
                >
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={`whitespace-nowrap tabular-nums ${
                        col.format === 'text' || col.format === 'date' || col.format === 'ncrc' ? 'text-left' : 'text-right'
                      } ${
                        col.key === 'totalNeto'
                          ? 'font-semibold text-emerald-400'
                          : ''
                      }`}
                    >
                      {col.key === 'esClienteNuevo' ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          order[col.key] === true
                            ? 'bg-blue-500/10 text-blue-400'
                            : order[col.key] === false
                              ? 'bg-white/[0.05] text-gray-500'
                              : 'text-gray-600'
                        }`}>
                          {formatCell(order[col.key], col.format)}
                        </span>
                      ) : (
                        formatCell(order[col.key], col.format)
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}