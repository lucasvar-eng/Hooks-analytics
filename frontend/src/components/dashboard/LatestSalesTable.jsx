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
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          Últimas Ventas
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-750">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-gray-500">
                  Sin órdenes en este período
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order._id}
                  onClick={() => onOrderClick?.(order)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition"
                >
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2 whitespace-nowrap ${
                        col.key === 'totalNeto'
                          ? 'font-semibold text-green-600 dark:text-green-400'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {formatCell(order[col.key], col.format)}
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
