import { useState, useMemo } from 'react';

/**
 * Tabla "Comercial por categoría" — surtido, cobertura y margen.
 * Sortable por columna (cycle desc → asc → none).
 *
 * Recibe el array `categories` que devuelve `/products/commercial`.
 */

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}
function fmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('es-AR');
}
function fmtCoverage(days) {
  if (days == null || isNaN(days)) return '—';
  if (days >= 9999) return '∞';
  if (days >= 1000) return `${Math.round(days / 30)} m`;
  return `${Math.round(days)} d`;
}

const COLS = [
  { key: 'categoria', label: 'Categoría', align: 'left', accessor: (c) => (c.categoria || '').toLowerCase() },
  { key: 'revenue', label: 'Ingresos', accessor: (c) => c.revenue || 0 },
  { key: 'unitsSold', label: 'Unidades', accessor: (c) => c.unitsSold || 0 },
  { key: 'stockUnits', label: 'Stock', accessor: (c) => c.stockUnits || 0 },
  { key: 'stockValue', label: 'Stock valorizado', accessor: (c) => c.stockValue || 0 },
  { key: 'grossMarginPct', label: 'Margen %', accessor: (c) => c.grossMarginPct || 0 },
  { key: 'coverageDays', label: 'Cobertura', accessor: (c) => c.coverageDays || 0 },
];

export default function CategoryTable({ categories, coverageHasIssue }) {
  const [sortKey, setSortKey] = useState('revenue');
  const [sortDir, setSortDir] = useState('desc');

  const sorted = useMemo(() => {
    const col = COLS.find((c) => c.key === sortKey);
    if (!col || !categories) return categories || [];
    const arr = [...categories];
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
  }, [categories, sortKey, sortDir]);

  const handleSort = (key) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  if (!categories?.length) return null;

  return (
    <div className="card p-5">
      <div className="flex justify-between items-baseline mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Comercial por categoría</p>
          <p className="text-[12px] text-gray-200 mt-0.5">Surtido, cobertura y margen — click en columnas para ordenar</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-white/[0.08]">
              {COLS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-[1.2px] cursor-pointer select-none transition
                    ${col.align === 'left' ? 'text-left' : 'text-center'}
                    ${sortKey === col.key ? 'text-blue-300' : 'text-gray-200 hover:text-white'}`}
                >
                  {col.label}
                  <span className="ml-1 text-[10px] font-normal">
                    {sortKey === col.key ? (sortDir === 'desc' ? '▼' : '▲') : <span className="opacity-40">⇅</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((cat) => (
              <tr key={cat.categoria} className="border-b border-white/[0.03] last:border-b-0">
                <td className="px-3 py-3 text-left text-white font-semibold text-[13px]">{cat.categoria}</td>
                <td className="px-3 py-3 text-center text-emerald-400 font-bold tabular-nums text-[13px]">{fmtMoney(cat.revenue)}</td>
                <td className="px-3 py-3 text-center text-gray-100 tabular-nums">{fmtNum(cat.unitsSold)}</td>
                <td className="px-3 py-3 text-center text-gray-100 tabular-nums">{fmtNum(cat.stockUnits)}</td>
                <td className={`px-3 py-3 text-center tabular-nums ${(cat.stockValue || 0) > 0 ? 'text-gray-100' : 'text-gray-300'}`}>
                  {fmtMoney(cat.stockValue)}
                </td>
                <td className={`px-3 py-3 text-center tabular-nums ${cat.grossMarginPct ? 'text-gray-100' : 'text-gray-300'}`}>
                  {cat.grossMarginPct ? `${Number(cat.grossMarginPct).toFixed(1).replace('.', ',')}%` : '—'}
                </td>
                <td className={`px-3 py-3 text-center tabular-nums font-semibold
                  ${cat.coverageDays > 365 ? 'text-red-400'
                    : cat.coverageDays > 90 ? 'text-amber-400'
                    : 'text-emerald-400'}`}>
                  {fmtCoverage(cat.coverageDays)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {coverageHasIssue && (
        <p className="mt-3 text-[11.5px] text-gray-300">
          ⚠ Cobertura muy alta cuando hay pocas ventas en el período — los ratios se acomodan con rangos más largos o cuando se carguen costos.
        </p>
      )}
    </div>
  );
}
