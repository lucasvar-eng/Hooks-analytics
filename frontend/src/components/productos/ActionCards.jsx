/**
 * Dos cards de acciones recomendadas:
 *  - Capital atrapado: dead stock ordenado por valor de stock (unidades × precio si no hay COGS).
 *  - Hay que reponer: vendiendo bien con stock para < 7 días.
 *
 * Reciben la lista completa de productos y derivan las dos listas en cliente.
 *
 * Cuando no hay costos cargados usamos precio como aproximación del valor en juego.
 * Es "valor de catálogo atrapado" (no costo real), pero ordena correctamente la lista.
 */

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}

function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '—';
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

function daysSince(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

export function CapitalAtrapadoCard({ products, onProductClick, limit = 5 }) {
  // Dead stock con stock > 0 — ordenado por valor (unidades × precio si no hay COGS)
  const dead = (products || [])
    .filter((p) => (p.periodSales || 0) === 0 && (p.stock || 0) > 0)
    .map((p) => {
      const unitCost = p.costoUnitario || p.precio || 0;
      return {
        ...p,
        trappedValue: (p.stock || 0) * unitCost,
        daysWithoutSale: daysSince(p.ultimaVenta),
      };
    })
    .sort((a, b) => b.trappedValue - a.trappedValue);

  const rows = dead.slice(0, limit);

  return (
    <div className="card p-5">
      <div className="flex justify-between items-baseline mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Capital atrapado</p>
          <p className="text-[12px] text-gray-200 mt-0.5">Más stock + más tiempo sin venta — candidatos a liquidar</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-200 text-[12px] py-4 text-center">No hay productos con stock parado en el período.</p>
      ) : (
        rows.map((p, idx) => (
          <button
            type="button"
            key={p._id}
            onClick={() => onProductClick?.(p)}
            className={`w-full flex items-center gap-3 text-left py-2.5 ${idx < rows.length - 1 ? 'border-b border-white/[0.03]' : ''}
              hover:bg-white/[0.02] -mx-2 px-2 rounded-md transition`}
          >
            {p.imagenUrl
              ? <img src={p.imagenUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
              : <div className="w-8 h-8 rounded bg-white/[0.05] flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] text-white font-medium truncate">{p.nombre}</p>
              <p className="text-[11px] text-gray-300 mt-0.5">
                {p.stock} unid.
                {p.daysWithoutSale != null && <> · {p.daysWithoutSale} días sin venta</>}
                {' · '}{fmtMoney(p.precio)}
              </p>
            </div>
            <span className="text-[12.5px] font-bold text-amber-400 tabular-nums flex-shrink-0">
              {fmtMoneyShort(p.trappedValue)}
            </span>
          </button>
        ))
      )}
    </div>
  );
}

export function RepongoCard({ products, onProductClick, limit = 5 }) {
  // Vendiendo (periodSales > 0) y con stock para < 7 días
  // Si no hay diasDeStock calcular como stock / velocity
  const lowStock = (products || [])
    .map((p) => {
      const velocity = p.velocity || 0;
      const stock = p.stock || 0;
      const dias = p.diasDeStock != null && p.diasDeStock > 0
        ? p.diasDeStock
        : (velocity > 0 ? stock / velocity : null);
      return { ...p, _diasStock: dias };
    })
    .filter((p) => {
      if (!p._diasStock) return false;
      if (p._diasStock > 7) return false;
      if ((p.velocity || 0) <= 0) return false;
      if ((p.stock || 0) === 0) return false; // Sin stock va al filtro principal, no acá
      return true;
    })
    .sort((a, b) => a._diasStock - b._diasStock);

  const rows = lowStock.slice(0, limit);

  return (
    <div className="card p-5">
      <div className="flex justify-between items-baseline mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Hay que reponer</p>
          <p className="text-[12px] text-gray-200 mt-0.5">Vendiendo bien y con stock para menos de 7 días</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-gray-200 text-[12px] py-4 text-center">No hay productos en riesgo de quiebre en el período.</p>
      ) : (
        rows.map((p, idx) => (
          <button
            type="button"
            key={p._id}
            onClick={() => onProductClick?.(p)}
            className={`w-full flex items-center gap-3 text-left py-2.5 ${idx < rows.length - 1 ? 'border-b border-white/[0.03]' : ''}
              hover:bg-white/[0.02] -mx-2 px-2 rounded-md transition`}
          >
            {p.imagenUrl
              ? <img src={p.imagenUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
              : <div className="w-8 h-8 rounded bg-white/[0.05] flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] text-white font-medium truncate">{p.nombre}</p>
              <p className="text-[11px] text-gray-300 mt-0.5">
                {p.stock} unid. · vende {Number(p.velocity).toFixed(1).replace('.', ',')}/día · {Number(p._diasStock).toFixed(1).replace('.', ',')} días de stock
              </p>
            </div>
            <span className={`text-[12.5px] font-bold tabular-nums flex-shrink-0
              ${p._diasStock <= 3 ? 'text-red-400' : 'text-amber-400'}`}>
              {p._diasStock <= 3 ? '⚠ ' : ''}{Math.round(p._diasStock)}d
            </span>
          </button>
        ))
      )}
    </div>
  );
}
