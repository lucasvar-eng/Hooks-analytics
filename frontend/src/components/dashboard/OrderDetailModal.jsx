function formatCurrency(value) {
  if (value == null) return '$0';
  return `$${Number(value).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

const DEDUCTIONS = [
  { key: 'comisionPago', label: 'Comisión de pago' },
  { key: 'comisionCuotas', label: 'Comisión de cuotas' },
  { key: 'impuestosIBB', label: 'Impuestos IBB' },
  { key: 'feePlataforma', label: 'Fee plataforma (TN)' },
  { key: 'costoEnvio', label: 'Costo de envío' },
  { key: 'costoProductos', label: 'Costo de productos (COGS)' },
];

export default function OrderDetailModal({ order, onClose }) {
  if (!order) return null;

  const totalDeducciones = DEDUCTIONS.reduce(
    (sum, d) => sum + (order[d.key] || 0),
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Orden #{order.tnOrderNumber}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {order.customerName} — {order.customerEmail}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl"
          >
            x
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Order info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Fecha</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {order.fechaCreacion
                  ? new Date(order.fechaCreacion).toLocaleDateString('es-AR')
                  : '—'}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Estado</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {order.paymentStatus || order.estado || '—'}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Gateway</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {order.gateway || '—'}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Cuotas</span>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {order.cantidadCuotas || 1}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Cliente</span>
              <p className="font-medium">
                <span
                  className={
                    order.esClienteNuevo
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-purple-600 dark:text-purple-400'
                  }
                >
                  {order.esClienteNuevo === true
                    ? 'Nuevo'
                    : order.esClienteNuevo === false
                      ? 'Recurrente'
                      : '—'}
                </span>
              </p>
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Desglose de costos
            </h4>

            {/* Total bruto */}
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-700 dark:text-gray-300">
                Total Bruto
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatCurrency(order.totalOrden)}
              </span>
            </div>

            {/* 6 deduction lines */}
            {DEDUCTIONS.map((d) => (
              <div key={d.key} className="flex justify-between text-sm mb-1">
                <span className="text-gray-500 dark:text-gray-400 pl-2">
                  - {d.label}
                </span>
                <span className="text-red-500">
                  -{formatCurrency(order[d.key])}
                </span>
              </div>
            ))}

            {/* Separator */}
            <div className="border-t border-gray-200 dark:border-gray-700 my-3" />

            {/* Total Neto */}
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-gray-900 dark:text-gray-100">
                Total Neto
              </span>
              <span className="text-green-600 dark:text-green-400">
                {formatCurrency(order.totalNeto)}
              </span>
            </div>

            {/* Liquidable */}
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-500 dark:text-gray-400">
                Liquidable
              </span>
              <span className="text-gray-700 dark:text-gray-300">
                {formatCurrency(order.liquidable)}
              </span>
            </div>
          </div>

          {/* Line items */}
          {order.lineItems?.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Productos
              </h4>
              {order.lineItems.map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between text-sm mb-1"
                >
                  <span className="text-gray-700 dark:text-gray-300 truncate mr-2">
                    {item.nombre} x{item.cantidad}
                  </span>
                  <span className="text-gray-900 dark:text-gray-100 shrink-0">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
