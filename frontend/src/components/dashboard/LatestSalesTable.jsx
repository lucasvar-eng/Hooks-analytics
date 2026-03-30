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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700/60">
        <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Últimas Ventas
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-white/[0.02]">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 ${col.format === 'text' || col.format === 'date' || col.format === 'ncrc' ? 'text-left' : 'text-right'} text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap border-b border-gray-200 dark:border-gray-700/60`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-xs text-gray-500 dark:text-gray-500">
                  Cargando...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-xs text-gray-500 dark:text-gray-500">
                  Sin órdenes en este período
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order._id}
                  onClick={() => onOrderClick?.(order)}
                  className="border-b border-gray-100 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-white/[0.02] cursor-pointer transition"
                >
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2 whitespace-nowrap tabular-nums ${
                        col.format === 'text' || col.format === 'date' || col.format === 'ncrc' ? 'text-left' : 'text-right'
                      } ${
                        col.key === 'totalNeto'
                          ? 'font-semibold text-green-600 dark:text-green-400'
                          : col.key === 'esClienteNuevo'
                            ? ''
                            : 'text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {col.key === 'esClienteNuevo' ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          order[col.key] === true
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : order[col.key] === false
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                              : 'text-gray-400'
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
