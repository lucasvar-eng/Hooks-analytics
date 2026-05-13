/**
 * Checklist visual de qué componentes de costo están cargados.
 * Convierte el problema en una to-do list: 5 filas con ✓ verde o ⚠ amber.
 *
 * Props:
 *   coverage: shape de `services/costCoverage.getCostCoverage`
 *   onConfigClick: () => void  // al hacer click en un faltante, abrir el config accordion
 */

const ITEMS = [
  {
    key: 'cogs',
    label: 'Costo de productos',
    subPresent: 'Costo unitario cargado por SKU',
    subMissing: (cov) => {
      const c = cov?.components?.cogs;
      if (!c) return 'Sin productos con costo';
      return `${c.totalProducts || 0} productos · ${c.productsWithCosts || 0} con costo`;
    },
  },
  {
    key: 'paymentCommission',
    label: 'Comisiones de cobro',
    subPresent: 'Configurado por medio de pago',
    subMissing: () => 'MercadoPago, Visa, débito, cuotas',
  },
  {
    key: 'fixedCosts',
    label: 'Costos fijos',
    subPresent: 'Alquiler, sueldos, herramientas',
    subMissing: () => 'Alquiler, sueldos, herramientas',
  },
  {
    key: 'shippingCost',
    label: 'Costo de envío',
    subPresent: 'Calculado por orden',
    subMissing: () => 'Sin configuración de zonas',
  },
  {
    key: 'adSpend',
    label: 'Inversión publicitaria',
    subPresent: 'Sincronizada con Meta',
    subMissing: () => 'Conectá Meta Ads',
    presentResolver: (cov, extras) => extras?.adsConnected !== false,
  },
];

export default function CostCoverageChecklist({ coverage, adsConnected, onConfigClick }) {
  if (!coverage?.components) return null;

  const rows = ITEMS.map((item) => {
    const present = item.presentResolver
      ? item.presentResolver(coverage, { adsConnected })
      : coverage.components[item.key]?.present === true;
    return {
      ...item,
      present,
      sub: present ? item.subPresent : item.subMissing(coverage),
    };
  });

  // Ordenar: faltantes arriba (más accionable), presentes abajo.
  rows.sort((a, b) => Number(a.present) - Number(b.present));

  return (
    <div className="card p-6">
      <div className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Qué falta para ver tu profit real</p>
        <p className="text-[12.5px] text-gray-200 mt-1">Componentes que el sistema usa para calcular margen</p>
      </div>

      {rows.map((row, idx) => (
        <button
          key={row.key}
          type="button"
          onClick={!row.present && onConfigClick ? onConfigClick : undefined}
          disabled={row.present || !onConfigClick}
          className={`w-full flex items-baseline justify-between text-left py-3
            ${idx < rows.length - 1 ? 'border-b border-white/[0.04]' : ''}
            ${!row.present && onConfigClick ? 'hover:bg-white/[0.02] -mx-2 px-2 rounded-md transition' : ''}`}
        >
          <div>
            <div className={`text-[13px] font-semibold ${row.present ? 'text-emerald-300' : 'text-amber-300'}`}>
              {row.label}
            </div>
            <div className="text-[11px] text-gray-300 mt-0.5">{row.sub}</div>
          </div>
          <span className={`text-[11px] font-semibold ${row.present ? 'text-emerald-400' : 'text-amber-400'}`}>
            {row.present ? '✓ ok' : '⚠ falta'}
          </span>
        </button>
      ))}
    </div>
  );
}
