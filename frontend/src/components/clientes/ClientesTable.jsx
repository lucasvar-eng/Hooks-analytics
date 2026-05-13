import { useMemo, useState, useEffect } from 'react';
import { SEGMENTS, SEGMENT_ORDER, getSegment } from './segmentsCatalog';

/**
 * Tabla principal de clientes — sigue el patrón de ProductsTable.
 *
 * - Filtros chip por segmento (Todos + 8 segmentos) con dot de color y conteo.
 * - Búsqueda por nombre, email o ID externo.
 * - Sort por columna (asc/desc cycle).
 * - Scroll vertical interno con header sticky.
 * - Paginación cliente (10/25/50/100).
 *
 * Recibe TODOS los customers cargados desde el padre (limit=5000) — opera 100% en cliente.
 */

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}
function fmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('es-AR');
}
function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function initialsOf(name, email) {
  const src = name || (email ? email.split('@')[0] : '');
  if (!src) return '?';
  const parts = src.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

const COLUMNS = [
  { key: 'name', label: 'Cliente', sortable: true, align: 'left', accessor: (c) => (c.name || c.email || '').toLowerCase() },
  { key: 'totalOrders', label: 'Compras', sortable: true, align: 'center', accessor: (c) => c.totalOrders || 0 },
  { key: 'totalSpent', label: 'Gasto total', sortable: true, align: 'center', accessor: (c) => c.totalSpent || 0, info: 'Cuánto gastó en total a lo largo de su vida (LTV)' },
  { key: 'avgTicket', label: 'Ticket promedio', sortable: true, align: 'center', accessor: (c) => (c.totalOrders ? (c.totalSpent || 0) / c.totalOrders : 0) },
  { key: 'lastOrderDate', label: 'Última compra', sortable: true, align: 'center', accessor: (c) => (c.lastOrderDate ? new Date(c.lastOrderDate).getTime() : 0) },
  { key: 'recency', label: 'Días sin comprar', sortable: true, align: 'center', accessor: (c) => c.recency ?? 999999, info: 'Días desde la última compra. Menos es mejor.' },
  { key: 'rfmScore', label: 'Score RFM', sortable: true, align: 'center', accessor: (c) => c.rfmScore || '', info: 'Recencia-Frecuencia-Monto (1-5 cada uno)' },
  { key: 'rfmSegment', label: 'Segmento', sortable: true, align: 'center', accessor: (c) => c.rfmSegment || '' },
  { key: 'cohortMonth', label: 'Mes de alta', sortable: true, align: 'center', accessor: (c) => c.cohortMonth || '' },
  { key: 'firstToSecondOrderLag', label: 'Demora 2da', sortable: true, align: 'center', accessor: (c) => c.firstToSecondOrderLag ?? 999999, info: 'Cuántos días tardó entre 1ra y 2da compra' },
];

export default function ClientesTable({
  customers,
  selectedSegment,
  onSegmentSelect,
  onRowClick,
}) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('totalSpent');
  const [sortDir, setSortDir] = useState('desc');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  // Conteos por segmento (sobre el array completo)
  const segmentCounts = useMemo(() => {
    const counts = { _all: customers.length };
    customers.forEach((c) => {
      const id = c.rfmSegment;
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
  }, [customers]);

  // Reset page cuando cambia filtro o búsqueda
  useEffect(() => { setPage(1); }, [selectedSegment, search]);

  // Filtrado
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (selectedSegment && c.rfmSegment !== selectedSegment) return false;
      if (!q) return true;
      const name = (c.name || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      const extId = String(c.externalCustomerId || '');
      return name.includes(q) || email.includes(q) || extId.includes(q);
    });
  }, [customers, selectedSegment, search]);

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

  const sortedColLabel = COLUMNS.find((c) => c.key === sortKey)?.label || '';

  return (
    <div className="card overflow-hidden p-0">
      {/* Filtros chip + search */}
      <div className="flex flex-wrap gap-2.5 items-center px-5 py-4 border-b border-white/[0.05]">
        <button
          type="button"
          onClick={() => onSegmentSelect?.(null)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border transition
            ${!selectedSegment
              ? 'bg-blue-500/15 border-blue-500/40 text-blue-200'
              : 'bg-white/[0.04] border-white/[0.08] text-gray-200 hover:border-white/20 hover:text-white'}`}
        >
          Todos
          <span className={`rounded-full px-1.5 py-px text-[10px] font-bold
            ${!selectedSegment ? 'bg-blue-500/25 text-blue-100' : 'bg-white/[0.08] text-gray-200'}`}>
            {fmtNum(segmentCounts._all)}
          </span>
        </button>
        {SEGMENT_ORDER.filter((id) => (segmentCounts[id] || 0) > 0).map((id) => {
          const seg = SEGMENTS[id];
          const isActive = selectedSegment === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSegmentSelect?.(isActive ? null : id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border transition
                ${isActive
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-200'
                  : 'bg-white/[0.04] border-white/[0.08] text-gray-200 hover:border-white/20 hover:text-white'}`}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: seg.color }} />
              {seg.label}
              <span className={`rounded-full px-1.5 py-px text-[10px] font-bold
                ${isActive ? 'bg-blue-500/25 text-blue-100' : 'bg-white/[0.08] text-gray-200'}`}>
                {fmtNum(segmentCounts[id])}
              </span>
            </button>
          );
        })}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar nombre, email o ID..."
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
                  {col.info && (
                    <span
                      title={col.info}
                      onClick={(e) => e.stopPropagation()}
                      className="ml-1 inline-flex items-center justify-center w-[12px] h-[12px] rounded-full bg-white/[0.08] text-gray-300 text-[8px] cursor-help"
                    >i</span>
                  )}
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
                  No hay clientes para este filtro o búsqueda.
                </td>
              </tr>
            )}
            {pageRows.map((c) => {
              const seg = getSegment(c.rfmSegment);
              const avgTicket = c.totalOrders ? (c.totalSpent || 0) / c.totalOrders : 0;
              const recencyTone = c.recency == null ? ''
                : c.recency <= 30 ? 'text-emerald-400'
                : c.recency >= 365 ? 'text-amber-400'
                : 'text-gray-100';
              return (
                <tr
                  key={c._id}
                  onClick={() => onRowClick?.(c)}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer"
                >
                  <td className="px-2.5 py-2.5 text-[12.5px] text-left">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-blue-500/15 text-blue-300 text-[11px] font-bold inline-flex items-center justify-center flex-shrink-0">
                        {initialsOf(c.name, c.email)}
                      </span>
                      <div className="min-w-0">
                        <div className="text-white font-medium truncate max-w-[220px]">{c.name || '—'}</div>
                        <div className="text-gray-300 text-[11px] truncate max-w-[220px]">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2.5 py-2.5 text-center text-[12.5px] tabular-nums">
                    {(c.totalOrders || 0) > 1
                      ? <span className="text-white font-semibold">{fmtNum(c.totalOrders)}</span>
                      : <span className="text-gray-300">{fmtNum(c.totalOrders || 0)}</span>}
                  </td>
                  <td className="px-2.5 py-2.5 text-center text-[12.5px] text-white font-semibold tabular-nums">
                    {fmtMoney(c.totalSpent)}
                  </td>
                  <td className="px-2.5 py-2.5 text-center text-[12.5px] text-gray-100 tabular-nums">
                    {fmtMoney(avgTicket)}
                  </td>
                  <td className="px-2.5 py-2.5 text-center text-[12.5px] text-gray-100 tabular-nums">
                    {fmtDate(c.lastOrderDate)}
                  </td>
                  <td className={`px-2.5 py-2.5 text-center text-[12.5px] font-semibold tabular-nums ${recencyTone}`}>
                    {c.recency != null ? `${fmtNum(c.recency)}d` : '—'}
                  </td>
                  <td className="px-2.5 py-2.5 text-center">
                    {c.rfmScore
                      ? <span className="font-mono text-[11.5px] text-gray-200 bg-white/[0.04] px-1.5 py-0.5 rounded">{c.rfmScore}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-2.5 py-2.5 text-center">
                    {c.rfmSegment
                      ? <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${seg.badgeClass}`}>
                          {seg.label}
                        </span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-2.5 py-2.5 text-center text-[12px] text-gray-100">{c.cohortMonth || '—'}</td>
                  <td className="px-2.5 py-2.5 text-center text-[12.5px] text-gray-100 tabular-nums">
                    {c.firstToSecondOrderLag != null
                      ? `${c.firstToSecondOrderLag}d`
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
          Mostrando <strong className="text-white">{fmtNum(sorted.length === 0 ? 0 : pageStart + 1)}–{fmtNum(Math.min(pageStart + pageSize, sorted.length))}</strong>
          {' '}de {fmtNum(sorted.length)}
          {selectedSegment && <> · filtro <strong className="text-blue-300">{getSegment(selectedSegment).label}</strong></>}
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
