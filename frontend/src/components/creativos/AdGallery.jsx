/**
 * Galería completa de anuncios. Maneja:
 *  - Toolbar: search, filtros (status, tier), sort
 *  - Grid responsive de AdGalleryCard
 *  - Selección múltiple (para comparador)
 *  - Paginación: muestra hasta N, botón "cargar más"
 */

import { useMemo, useState } from 'react';
import AdGalleryCard from './AdGalleryCard';

const SORT_OPTIONS = [
  { value: 'roas-desc', label: 'ROAS ↓', sort: (a, b) => (b.metrics?.roas || 0) - (a.metrics?.roas || 0) },
  { value: 'spend-desc', label: 'Gasto ↓', sort: (a, b) => (b.metrics?.spend || 0) - (a.metrics?.spend || 0) },
  { value: 'ctr-desc', label: 'CTR ↓', sort: (a, b) => (b.metrics?.ctr || 0) - (a.metrics?.ctr || 0) },
  { value: 'purchases-desc', label: 'Compras ↓', sort: (a, b) => (b.metrics?.purchases || 0) - (a.metrics?.purchases || 0) },
  { value: 'recent', label: 'Más reciente', sort: (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) },
];

const PAGE_SIZE = 24;

export default function AdGallery({
  ads = [],
  selectedIds = [],
  onToggleSelect,
  onClickAd,
  onClearSelection,
  onCompare,
  onAnalyze,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [sortBy, setSortBy] = useState('spend-desc');
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    return ads.filter((a) => {
      // Search
      if (search) {
        const s = search.toLowerCase().trim();
        const haystack = [a.nombre, a.creativeName, a.creativeBody, a.creativeTitle, a.metaId, a.parentName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(s)) return false;
      }
      // Status
      if (statusFilter === 'active' && a.status !== 'ACTIVE') return false;
      if (statusFilter === 'paused' && a.status !== 'PAUSED') return false;
      if (statusFilter === 'spend' && Number(a.metrics?.spend || 0) <= 0) return false;
      if (statusFilter === 'bleeding' && !(Number(a.metrics?.spend || 0) > 0 && Number(a.metrics?.purchases || 0) === 0)) return false;
      // Tier
      if (tierFilter !== 'all' && a.tier !== tierFilter) return false;
      return true;
    });
  }, [ads, search, statusFilter, tierFilter]);

  const sorted = useMemo(() => {
    const sortFn = SORT_OPTIONS.find((s) => s.value === sortBy)?.sort;
    return sortFn ? [...filtered].sort(sortFn) : filtered;
  }, [filtered, sortBy]);

  const visible = sorted.slice(0, pageSize);
  const hasMore = sorted.length > pageSize;

  const STATUS_OPTS = [
    { value: 'all', label: 'Todos', count: ads.length },
    { value: 'active', label: 'Activos', count: ads.filter((a) => a.status === 'ACTIVE').length },
    { value: 'paused', label: 'Pausados', count: ads.filter((a) => a.status === 'PAUSED').length },
    { value: 'spend', label: 'Con gasto', count: ads.filter((a) => Number(a.metrics?.spend || 0) > 0).length },
    { value: 'bleeding', label: 'Sangrando', count: ads.filter((a) => Number(a.metrics?.spend || 0) > 0 && Number(a.metrics?.purchases || 0) === 0).length },
  ];

  const TIER_OPTS = [
    { value: 'all', label: 'Todos' },
    { value: 'A', label: 'A', color: '#6ee7b7', count: ads.filter((a) => a.tier === 'A').length },
    { value: 'B', label: 'B', color: '#93c5fd', count: ads.filter((a) => a.tier === 'B').length },
    { value: 'C', label: 'C', color: '#fcd34d', count: ads.filter((a) => a.tier === 'C').length },
    { value: 'D', label: 'D', color: '#fdba74', count: ads.filter((a) => a.tier === 'D').length },
    { value: 'E', label: 'E', color: '#fca5a5', count: ads.filter((a) => a.tier === 'E').length },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, copy o ID..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[12px] text-white placeholder-app-muted focus:outline-none focus:border-blue-500/40"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-app-muted hover:text-white text-[14px]"
              >
                ×
              </button>
            )}
          </div>

          {/* Status pills */}
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-md p-0.5">
            {STATUS_OPTS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-2.5 py-1.5 rounded text-[11px] font-medium transition ${
                  statusFilter === opt.value
                    ? 'bg-blue-500/20 text-blue-200'
                    : 'text-app-secondary hover:text-white'
                }`}
              >
                {opt.label}
                <span className="ml-1.5 text-app-muted text-[10px] tabular-nums">{opt.count}</span>
              </button>
            ))}
          </div>

          {/* Tier pills */}
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-md p-0.5">
            {TIER_OPTS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTierFilter(opt.value)}
                className={`px-2 py-1.5 rounded text-[11px] font-medium transition ${
                  tierFilter === opt.value
                    ? 'bg-blue-500/20 text-blue-200'
                    : 'text-app-secondary hover:text-white'
                }`}
                style={{ color: tierFilter === opt.value ? undefined : (opt.color || undefined) }}
              >
                {opt.label}
                {opt.count != null && <span className="ml-1 text-app-muted text-[10px] tabular-nums">{opt.count}</span>}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[12px] text-white focus:outline-none focus:border-blue-500/40"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>Ordenar: {opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-blue-500/25 bg-blue-500/10 flex-wrap">
          <span className="text-blue-200 font-semibold text-[13px]">
            {selectedIds.length} {selectedIds.length === 1 ? 'anuncio' : 'anuncios'} seleccionado{selectedIds.length === 1 ? '' : 's'}
          </span>
          <span className="text-app-secondary text-[11.5px]">
            {selectedIds.length >= 2 ? 'Listo para comparar lado a lado o ver la lectura del mensaje' : 'Sumá al menos 2 para comparar'}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={onClearSelection}
              className="bg-transparent text-app-secondary border border-white/[0.12] px-3 py-1.5 rounded-md text-[12px] hover:text-white"
            >
              Limpiar
            </button>
            {onAnalyze && (
              <button
                onClick={() => onAnalyze(selectedIds)}
                className="bg-transparent text-app-secondary border border-white/[0.12] px-3 py-1.5 rounded-md text-[12px] hover:text-white"
              >
                Ver lectura
              </button>
            )}
            {onCompare && (
              <button
                onClick={() => onCompare(selectedIds)}
                disabled={selectedIds.length < 2}
                className="bg-blue-500 text-white px-3.5 py-1.5 rounded-md text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-600"
              >
                Comparar →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="card p-12 text-center text-app-secondary text-[13px]">
          {ads.length === 0
            ? 'Todavía no sincronizamos anuncios para esta tienda.'
            : 'Ningún anuncio coincide con los filtros aplicados.'}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {visible.map((ad) => (
            <AdGalleryCard
              key={ad._id || ad.metaId}
              ad={ad}
              selected={selectedIds.includes(ad.metaId)}
              onToggleSelect={() => onToggleSelect?.(ad.metaId)}
              onClick={onClickAd}
            />
          ))}
        </div>
      )}

      {/* Footer paginación */}
      <div className="flex items-center justify-center gap-3 text-[12px] text-app-muted pt-2">
        <span>
          Mostrando {visible.length} de {sorted.length} {sorted.length !== ads.length && `(filtrados de ${ads.length})`}
        </span>
        {hasMore && (
          <button
            onClick={() => setPageSize((s) => s + PAGE_SIZE)}
            className="text-blue-400 hover:text-blue-300 font-medium"
          >
            Cargar {Math.min(PAGE_SIZE, sorted.length - pageSize)} más →
          </button>
        )}
      </div>
    </div>
  );
}
