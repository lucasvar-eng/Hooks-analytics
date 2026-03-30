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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#161616] border border-white/[0.08] rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div>
            <h3 className="text-[15px] font-semibold text-white">
              Orden #{order.tnOrderNumber}
            </h3>
            <p className="text-[12px] text-gray-500 mt-0.5">
              {order.customerName} — {order.customerEmail}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-400 transition text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Order info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="kpi-label">Fecha</p>
              <p className="text-[13px] font-medium text-white mt-0.5">
                {order.fechaCreacion
                  ? new Date(order.fechaCreacion).toLocaleDateString('es-AR')
                  : '—'}
              </p>
            </div>
            <div>
              <p className="kpi-label">Estado</p>
              <p className="text-[13px] font-medium text-white mt-0.5">
                {order.paymentStatus || order.estado || '—'}
              </p>
            </div>
            <div>
              <p className="kpi-label">Gateway</p>
              <p className="text-[13px] font-medium text-white mt-0.5">
                {order.gateway || '—'}
              </p>
            </div>
            <div>
              <p className="kpi-label">Cuotas</p>
              <p className="text-[13px] font-medium text-white mt-0.5">
                {order.cantidadCuotas || 1}
              </p>
            </div>
            <div>
              <p className="kpi-label">Cliente</p>
              <p className={`text-[13px] font-medium mt-0.5 ${
                order.esClienteNuevo ? 'text-blue-400' : 'text-purple-400'
              }`}>
                {order.esClienteNuevo === true
                  ? 'Nuevo'
                  : order.esClienteNuevo === false
                    ? 'Recurrente'
                    : '—'}
              </p>
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="border-t border-white/[0.06] pt-4">
            <h4 className="text-[12px] font-semibold text-white mb-3">
              Desglose de costos
            </h4>

            <div className="flex justify-between text-[12px] mb-2">
              <span className="text-gray-400">Total Bruto</span>
              <span className="font-medium text-white">{formatCurrency(order.totalOrden)}</span>
            </div>

            {DEDUCTIONS.map((d) => (
              <div key={d.key} className="flex justify-between text-[12px] mb-1">
                <span className="text-gray-600 pl-2">- {d.label}</span>
                <span className="text-red-400">-{formatCurrency(order[d.key])}</span>
              </div>
            ))}

            <div className="border-t border-white/[0.06] my-3" />

            <div className="flex justify-between text-[13px] font-semibold">
              <span className="text-white">Total Neto</span>
              <span className="text-emerald-400">{formatCurrency(order.totalNeto)}</span>
            </div>

            <div className="flex justify-between text-[12px] mt-1">
              <span className="text-gray-600">Liquidable</span>
              <span className="text-gray-400">{formatCurrency(order.liquidable)}</span>
            </div>
          </div>

          {/* Line items */}
          {order.lineItems?.length > 0 && (
            <div className="border-t border-white/[0.06] pt-4">
              <h4 className="text-[12px] font-semibold text-white mb-3">Productos</h4>
              {order.lineItems.map((item, i) => (
                <div key={i} className="flex justify-between text-[12px] mb-1">
                  <span className="text-gray-400 truncate mr-2">
                    {item.nombre} x{item.cantidad}
                  </span>
                  <span className="text-white shrink-0">{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}