import { useMemo, useState } from 'react';

/**
 * Tabla principal de productos.
 *
 * - Filtros chip (Todos / Vendidos / Sin movimiento / Sin stock / Sobrestock / Sin costo)
 * - Búsqueda por nombre o SKU
 * - Sort por click en cualquier header (asc/desc/none cycle)
 * - Scroll vertical interno con header sticky
 * - Paginación cliente · "Filas por página" (10/25/50/100)
 *
 * Recibe TODOS los productos cargados desde el padre y opera 100% en cliente.
 * Para catálogos > ~5k habría que paginar contra backend; con 1.869 (Límite) anda fluido.
 */

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}
function fmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('es-AR');
}

const FILTERS = [
  { id: 'all', label: 'Todos', test: () => true },
  { id: 'sold', label: 'Vendidos', test: (p) => (p.periodSales || 0) > 0 },
  { id: 'dead', label: 'Sin movimiento', test: (p) => isDeadStock(p) },
  { id: 'out', label: 'Sin stock', test: (p) => p.stock === 0 },
  { id: 'over', label: 'Sobrestock', test: (p) => isOverstock(p) },
  { id: 'nocost', label: 'Sin costo', test: (p) => !p.costoUnitario || p.costoUnitario === 0 },
];

function isDeadStock(p) {
  if (!p) return false;
  if ((p.periodSales || 0) > 0) return false;
  if ((p.stock || 0) === 0) return false;
  // Si no hay venta en 30 días y stock > 0 → dead stock
  return true;
}

function isOverstock(p) {
  // Más de 60 días de stock o ratio muy alto
  if (p.diasDeStock != null && p.diasDeStock > 60) return true;
  return false;
}

function healthBadge(p) {
  if (p.stock === 0) return { label: 'Sin stock', className: 'bg-red-500/15 text-red-300' };
  if (p.stock <= 5 && (p.velocity || 0) > 0.5) return { label: 'Stock bajo', className: 'bg-red-500/15 text-red-300' };
  if (isOverstock(p)) return { label: 'Sobrestock', className: 'bg-purple-500/15 text-purple-300' };
  if (isDeadStock(p)) return { label: 'Dead stock', className: 'bg-amber-500/15 text-amber-300' };
  return null;
}

// Columnas definidas con sort key + accessor para sort
const COLUMNS = [
  { key: 'nombre', label: 'Producto', sortable: true, align: 'left',  accessor: (p) => p.nombre?.toLowerCase() || '' },
  { key: 'tnProductId', label: 'ID', sortable: true, align: 'center', accessor: (p) => p.tnProductId || '' },
  { key: 'activo', label: 'Estado', sortable: true, align: 'center', accessor: (p) => (p.activo ? 1 : 0) },
  { key: 'categoria', label: 'Categoría', sortable: true, align: 'center', accessor: (p) => p.categoria || '' },
  { key: 'subcategoria', label: 'Subcategoría', sortable: true, align: 'center', accessor: (p) => p.subcategoria || '' },
  { key: 'precio', label: 'Precio', sortable: true, align: 'center', accessor: (p) => p.precio || 0 },
  { key: 'costoUnitario', label: 'COGS', sortable: true, align: 'center', accessor: (p) => p.costoUnitario || 0 },
  { key: 'margenBrutoPct', label: 'Margen %', sortable: true, align: 'center', accessor: (p) => p.margenBrutoPct || 0 },
  { key: 'stock', label: 'Stock', sortable: true, align: 'center', accessor: (p) => p.stock || 0 },
  { key: 'periodSales', label: 'Vendidos', sortable: true, align: 'center', accessor: (p) => p.periodSales || 0 },
  { key: 'periodRevenue', label: 'Ingresos', sortable: true, align: 'center', accessor: (p) => p.periodRevenue || 0 },
  { key: 'velocity', label: 'Velocidad', sortable: true, align: 'center', accessor: (p) => p.velocity || 0 },
  { key: 'diasDeStock', label: 'Días stock', sortable: true, align: 'center', accessor: (p) => p.diasDeStock || 0 },
  { key: 'health', label: 'Salud', sortable: false, align: 'center' },
  { key: 'link', label: '', sortable: false, align: 'center' },
];

export default function ProductsTable({ products, onRowClick }) {
  const [filterId, setFilterId] = useState('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('periodSales');
  const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  // Conteos por filtro (sobre el array completo) para los chips
  const filterCounts = useMemo(() => {
    const counts = {};
    FILTERS.forEach((f) => { counts[f.id] = products.filter(f.test).length; });
    return counts;
  }, [products]);

  // Filtrado + búsqueda
  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filterId) || FILTERS[0];
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (!f.test(p)) return false;
      if (!q) return true;
      const name = (p.nombre || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const id = String(p.tnProductId || '');
      return name.includes(q) || sku.includes(q) || id.includes(q);
    });
  }, [products, filterId, search]);

  // Sort
  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey);
    if (!col || !col.accessor) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = col.accessor(a);
      const vb = col.accessor(b);
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // Paginación cliente
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageRows = sorted.slice(pageStart, pageStart + pageSize);

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const handleFilter = (id) => {
    setFilterId(id);
    setPage(1);
  };

  const handleSearch = (val) => {
    setSearch(val);
    setPage(1);
  };

  const sortedColLabel = COLUMNS.find((c) => c.key === sortKey)?.label || '';

  return (
    <div className="card overflow-hidden p-0">
      {/* Filtros + search */}
      <div className="flex flex-wrap gap-2.5 items-center px-5 py-4 border-b border-white/[0.05]">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => handleFilter(f.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border transition
              ${filterId === f.id
                ? 'bg-blue-500/15 border-blue-500/40 text-blue-200'
                : 'bg-white/[0.04] border-white/[0.08] text-gray-200 hover:border-white/20 hover:text-white'}`}
          >
            {f.label}
            <span className={`rounded-full px-1.5 py-px text-[10px] font-bold
              ${filterId === f.id ? 'bg-blue-500/25 text-blue-100' : 'bg-white/[0.08] text-gray-200'}`}>
              {fmtNum(filterCounts[f.id])}
            </span>
          </button>
        ))}
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar producto, SKU o ID..."
          className="ml-auto bg-white/[0.04] border border-white/[0.08] rounded-full px-3 py-1.5 text-[12px] text-white placeholder:text-gray-400 outline-none focus:border-blue-500/40 min-w-[200px] max-w-[280px] flex-1"
        />
      </div>

      {/* Tabla con scroll interno */}
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '720px' }}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  className={`sticky top-0 z-10 whitespace-nowrap px-2.5 py-3 text-[10px] font-bold uppercase tracking-[1.2px] border-b border-white/[0.08] transition
                    ${col.sortable ? 'cursor-pointer select-none' : ''}
                    ${col.align === 'left' ? 'text-left' : 'text-center'}
                    ${sortKey === col.key ? 'text-blue-300' : 'text-gray-200 hover:text-white'}`}
                  style={{ background: '#131316' }}
                >
                  {col.label}
                  {col.sortable && (
                    <span className="ml-1 text-[10px] font-normal">
                      {sortKey === col.key
                        ? (sortDir === 'desc' ? '▼' : '▲')
                        : <span className="opacity-40">⇅</span>}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center py-12 text-[12.5px] text-gray-300">
                  No hay productos para este filtro o búsqueda.
                </td>
              </tr>
            )}
            {pageRows.map((p) => {
              const health = healthBadge(p);
              const isLowStockBadgeRed = p.diasDeStock != null && p.diasDeStock <= 7 && p.diasDeStock > 0;
              return (
                <tr
                  key={p._id}
                  onClick={() => onRowClick?.(p)}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer"
                >
                  {/* Producto */}
                  <td className="px-2.5 py-2.5 text-[12.5px] text-left">
                    <div className="flex items-center gap-2.5">
                      {p.imagenUrl ? (
                        <img src={p.imagenUrl} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded bg-white/[0.05] flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-white font-medium truncate max-w-[260px]">{p.nombre}</div>
                        <div className="text-gray-300 text-[11px] truncate max-w-[260px]">{p.sku || 'Sin SKU'}</div>
                      </div>
                    </div>
                  </td>
                  {/* ID */}
                  <td className="px-2.5 py-2.5 text-center text-[12px] text-gray-300 tabular-nums">{p.tnProductId || '—'}</td>
                  {/* Estado */}
                  <td className="px-2.5 py-2.5 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide
                      ${p.activo
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-white/[0.06] text-gray-200'}`}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {/* Categoría / Subcategoría */}
                  <td className="px-2.5 py-2.5 text-center text-[12px] text-gray-100">{p.categoria || '—'}</td>
                  <td className="px-2.5 py-2.5 text-center text-[12px] text-gray-100">{p.subcategoria || '—'}</td>
                  {/* Precio */}
                  <td className="px-2.5 py-2.5 text-center text-[12.5px] text-gray-100 tabular-nums">{fmtMoney(p.precio)}</td>
                  {/* COGS */}
                  <td className={`px-2.5 py-2.5 text-center text-[12.5px] tabular-nums
                    ${(p.costoUnitario || 0) > 0 ? 'text-gray-100' : 'text-gray-300'}`}>
                    {fmtMoney(p.costoUnitario)}
                  </td>
                  {/* Margen % */}
                  <td className={`px-2.5 py-2.5 text-center text-[12.5px] font-semibold tabular-nums
                    ${!p.margenBrutoPct ? 'text-gray-300'
                      : (p.margenBrutoPct > 30 ? 'text-emerald-400'
                        : p.margenBrutoPct > 15 ? 'text-amber-400'
                        : 'text-red-400')}`}>
                    {p.margenBrutoPct ? `${Number(p.margenBrutoPct).toFixed(1).replace('.', ',')}%` : '—'}
                  </td>
                  {/* Stock */}
                  <td className="px-2.5 py-2.5 text-center text-[12.5px] tabular-nums">
                    <span className={p.stock === 0 ? 'text-red-300' : 'text-white'}>{fmtNum(p.stock)}</span>
                  </td>
                  {/* Vendidos */}
                  <td className="px-2.5 py-2.5 text-center text-[12.5px] tabular-nums">
                    {(p.periodSales || 0) > 0
                      ? <span className="text-white font-semibold">{fmtNum(p.periodSales)}</span>
                      : <span className="text-gray-300">0</span>}
                  </td>
                  {/* Ingresos */}
                  <td className="px-2.5 py-2.5 text-center text-[12.5px] tabular-nums">
                    {(p.periodRevenue || 0) > 0
                      ? <span className="text-white font-semibold">{fmtMoney(p.periodRevenue)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  {/* Velocidad */}
                  <td className="px-2.5 py-2.5 text-center text-[12.5px] text-gray-100 tabular-nums">
                    {p.velocity != null ? Number(p.velocity).toFixed(1).replace('.', ',') : '—'}
                  </td>
                  {/* Días stock */}
                  <td className={`px-2.5 py-2.5 text-center text-[12.5px] tabular-nums
                    ${isLowStockBadgeRed ? 'text-red-300 font-semibold' : 'text-gray-100'}`}>
                    {p.diasDeStock != null && p.diasDeStock > 0 ? `${Math.round(p.diasDeStock)}d` : '—'}
                  </td>
                  {/* Salud */}
                  <td className="px-2.5 py-2.5 text-center">
                    {health
                      ? <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${health.className}`}>{health.label}</span>
                      : <span className="text-gray-300 text-[11px]">—</span>}
                  </td>
                  {/* Link */}
                  <td className="px-2.5 py-2.5 text-center">
                    {p.productUrl
                      ? <a href={p.productUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-300 text-[11.5px] hover:underline">Ver</a>
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer paginación */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-white/[0.05]">
        <span className="text-[11.5px] text-gray-300">
          Mostrando <strong className="text-white">{fmtNum(pageStart + 1)}–{fmtNum(Math.min(pageStart + pageSize, sorted.length))}</strong>
          {' '}de {fmtNum(sorted.length)}
          {filterId !== 'all' && <> · filtro <strong className="text-blue-300">{FILTERS.find(f => f.id === filterId).label}</strong></>}
          {' '}· ordenando por <strong className="text-blue-300">{sortedColLabel} {sortDir === 'desc' ? '▼' : '▲'}</strong>
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-gray-300">Filas por página</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="bg-white/[0.04] border border-white/[0.08] rounded-md px-2 py-1 text-[11.5px] text-gray-100"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="bg-white/[0.04] border border-white/[0.08] rounded-md px-2.5 py-1 text-[11.5px] text-gray-200 hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ‹
          </button>
          <span className="text-[11.5px] text-gray-300">Pág. {safePage} de {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="bg-white/[0.04] border border-white/[0.08] rounded-md px-2.5 py-1 text-[11.5px] text-gray-200 hover:bg-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
