/**
 * Tabla de campañas más rica e interactiva:
 *  - Search por nombre / objective / metaId
 *  - Filtros por estado (todas / activas / pausadas / con gasto)
 *  - Filtros por veredicto
 *  - Sort clickeable por columna (numerical o alfabético)
 *  - Columnas: status, nombre, gasto, % spend, revenue, compras, ROAS, CPA,
 *    CPC, CTR, alcance, frecuencia, veredicto
 *  - Fila expandible con desglose adicional (cuando hay tiempo agregamos
 *    drill a adsets/ads)
 */

import { Fragment, useMemo, useState } from 'react';

const STATUS_PILL = {
  ACTIVE: { label: 'Activa', bg: 'bg-emerald-500/10', text: 'text-emerald-300', dot: '#34d399' },
  PAUSED: { label: 'Pausada', bg: 'bg-amber-500/10', text: 'text-amber-300', dot: '#fbbf24' },
  ARCHIVED: { label: 'Archivada', bg: 'bg-white/[0.04]', text: 'text-app-muted', dot: '#71717a' },
  DELETED: { label: 'Borrada', bg: 'bg-red-500/10', text: 'text-red-300', dot: '#f87171' },
  SIN_ESTADO: { label: 'Sin estado', bg: 'bg-white/[0.04]', text: 'text-app-muted', dot: '#71717a' },
};

const VERDICT_PILL = {
  ESCALAR: { label: 'Escalar', bg: 'bg-emerald-500/15', text: 'text-emerald-300' },
  PAUSAR: { label: 'Pausar', bg: 'bg-red-500/15', text: 'text-red-300' },
  TESTEAR: { label: 'Testear', bg: 'bg-blue-500/15', text: 'text-blue-300' },
  REVISAR: { label: 'Revisar', bg: 'bg-amber-500/15', text: 'text-amber-300' },
  MANTENER: { label: 'Mantener', bg: 'bg-white/[0.06]', text: 'text-app-secondary' },
};

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}
function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '—';
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  if (n === 0) return '$0';
  return `$${Math.round(n)}`;
}
function fmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('es-AR');
}
function fmtPct(v, digits = 2) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(digits)}%`;
}
function fmtMultiple(v, digits = 2) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(digits)}x`;
}

function roasTone(v) {
  if (v == null) return '';
  if (v >= 2.5) return 'text-emerald-300';
  if (v >= 1.5) return 'text-amber-300';
  if (v > 0) return 'text-red-300';
  return 'text-app-muted';
}

function ctrTone(v) {
  if (v == null) return '';
  if (v >= 1.5) return 'text-emerald-300';
  if (v >= 0.5) return 'text-amber-300';
  if (v > 0) return 'text-red-300';
  return 'text-app-muted';
}

const COLUMNS = [
  { key: 'status', label: 'Estado', align: 'left', width: 'w-[100px]' },
  { key: 'nombre', label: 'Campaña', align: 'left', width: 'w-auto' },
  { key: 'spend', label: 'Gasto', align: 'center', width: 'w-[120px]' },
  { key: 'spendShare', label: '% spend', align: 'center', width: 'w-[120px]' },
  { key: 'revenue', label: 'Revenue ads', align: 'center', width: 'w-[130px]' },
  { key: 'roas', label: 'ROAS', align: 'center', width: 'w-[90px]' },
  { key: 'purchases', label: 'Compras', align: 'center', width: 'w-[90px]' },
  { key: 'cpa', label: 'CPA', align: 'center', width: 'w-[110px]' },
  { key: 'cpc', label: 'CPC', align: 'center', width: 'w-[90px]' },
  { key: 'ctr', label: 'CTR', align: 'center', width: 'w-[90px]' },
  { key: 'reach', label: 'Alcance', align: 'center', width: 'w-[110px]' },
  { key: 'frequency', label: 'Frec.', align: 'center', width: 'w-[80px]' },
  { key: 'hookRate', label: 'Hook %', align: 'center', width: 'w-[90px]' },
  { key: 'verdict', label: 'Veredicto', align: 'center', width: 'w-[110px]' },
];

function frequencyTone(v) {
  if (!v) return '';
  if (v >= 3) return 'text-red-300';
  if (v >= 2.5) return 'text-amber-300';
  if (v >= 1.5) return 'text-emerald-300';
  return 'text-app-secondary';
}

function hookRateTone(v) {
  if (!v) return '';
  if (v >= 30) return 'text-emerald-300';
  if (v >= 15) return 'text-amber-300';
  return 'text-red-300';
}

export default function CampaignsTableRich({ campaigns = [] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | paused | spend | nospend
  const [verdictFilter, setVerdictFilter] = useState('all');
  const [sortBy, setSortBy] = useState('spend');
  const [sortDir, setSortDir] = useState('desc');

  const totalSpend = useMemo(
    () => campaigns.reduce((s, c) => s + Number(c.metrics?.spend || 0), 0),
    [campaigns]
  );

  // Enriquecer rows con campos derivados antes de filtrar/ordenar
  const enriched = useMemo(() => {
    return campaigns.map((c) => {
      const m = c.metrics || {};
      const spend = Number(m.spend || 0);
      return {
        ...c,
        _spend: spend,
        _revenue: Number(m.revenue || m.purchaseValue || 0),
        _purchases: Number(m.purchases || 0),
        _roas: Number(m.roas || 0),
        _cpa: Number(m.cpa || 0),
        _cpc: Number(m.cpc || 0),
        _ctr: Number(m.ctr || 0),
        _impressions: Number(m.impressions || 0),
        _reach: Number(m.reach || 0),
        _frequency: Number(m.frequency || 0),
        _hookRate: Number(m.hookRate || 0),
        _videoViews: Number(m.videoViews || 0),
        _videoViewsPct25: Number(m.videoViewsPct25 || 0),
        _videoViewsPct50: Number(m.videoViewsPct50 || 0),
        _spendShare: totalSpend > 0 ? (spend / totalSpend) * 100 : 0,
        _verdict: m.verdict || null,
        _name: String(c.nombre || '').toLowerCase(),
        _objective: String(c.objective || '').toLowerCase(),
        _metaId: String(c.metaId || ''),
      };
    });
  }, [campaigns, totalSpend]);

  const filtered = useMemo(() => {
    return enriched.filter((c) => {
      // Search
      if (search) {
        const s = search.toLowerCase().trim();
        if (!c._name.includes(s) && !c._objective.includes(s) && !c._metaId.includes(s)) return false;
      }
      // Status filter
      if (statusFilter === 'active' && c.status !== 'ACTIVE') return false;
      if (statusFilter === 'paused' && c.status !== 'PAUSED') return false;
      if (statusFilter === 'spend' && c._spend <= 0) return false;
      if (statusFilter === 'nospend' && c._spend > 0) return false;
      // Verdict filter
      if (verdictFilter !== 'all' && c._verdict !== verdictFilter) return false;
      return true;
    });
  }, [enriched, search, statusFilter, verdictFilter]);

  const sorted = useMemo(() => {
    const sortKey = sortBy === 'status' ? 'status'
      : sortBy === 'nombre' ? '_name'
      : sortBy === 'verdict' ? '_verdict'
      : sortBy === 'spendShare' ? '_spendShare'
      : `_${sortBy}`;

    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Strings (status, name, verdict)
      if (typeof av === 'string' || typeof bv === 'string') {
        const result = String(av || '').localeCompare(String(bv || ''));
        return sortDir === 'asc' ? result : -result;
      }
      const result = (Number(av) || 0) - (Number(bv) || 0);
      return sortDir === 'asc' ? result : -result;
    });
  }, [filtered, sortBy, sortDir]);

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir(key === 'nombre' || key === 'status' || key === 'verdict' ? 'asc' : 'desc');
    }
  };

  const STATUS_FILTER_OPTIONS = [
    { value: 'all', label: 'Todas', count: campaigns.length },
    { value: 'active', label: 'Activas', count: campaigns.filter((c) => c.status === 'ACTIVE').length },
    { value: 'paused', label: 'Pausadas', count: campaigns.filter((c) => c.status === 'PAUSED').length },
    { value: 'spend', label: 'Con gasto', count: enriched.filter((c) => c._spend > 0).length },
  ];

  const VERDICT_FILTER_OPTIONS = useMemo(() => {
    const counts = {};
    enriched.forEach((c) => {
      if (c._verdict) counts[c._verdict] = (counts[c._verdict] || 0) + 1;
    });
    return [
      { value: 'all', label: 'Todos los veredictos', count: enriched.filter((c) => c._verdict).length },
      ...Object.entries(counts).map(([k, v]) => ({ value: k, label: VERDICT_PILL[k]?.label || k, count: v })),
    ];
  }, [enriched]);

  return (
    <div className="card p-5">
      {/* Header con título y stats compactos */}
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h3 className="text-white text-[15px] font-semibold">Resultados por campaña</h3>
          <p className="text-app-secondary text-[12px] mt-1">
            Filtrá, ordená por columna · click en encabezado para ordenar
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-app-muted">
          <span><span className="text-white font-semibold">{filtered.length}</span> mostradas</span>
          <span><span className="text-white font-semibold">{enriched.filter((c) => c._spend > 0).length}</span> con gasto</span>
          <span><span className="text-white font-semibold">{fmtMoneyShort(totalSpend)}</span> spend total</span>
        </div>
      </div>

      {/* Toolbar de filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-white/[0.05]">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, objetivo o ID..."
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
          {STATUS_FILTER_OPTIONS.map((opt) => (
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

        {/* Verdict select */}
        {VERDICT_FILTER_OPTIONS.length > 1 && (
          <select
            value={verdictFilter}
            onChange={(e) => setVerdictFilter(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[12px] text-white focus:outline-none focus:border-blue-500/40"
          >
            {VERDICT_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label} ({opt.count})</option>
            ))}
          </select>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.14em] text-app-muted border-b border-white/[0.06]">
              {COLUMNS.map((col) => {
                const active = sortBy === col.key;
                const alignCls =
                  col.align === 'center' ? 'text-center' :
                  col.align === 'right' ? 'text-right' :
                  'text-left';
                return (
                  <th
                    key={col.key}
                    className={`${col.width} ${alignCls} px-4 pb-3 pt-1 font-semibold cursor-pointer select-none hover:text-white transition ${active ? 'text-white' : ''}`}
                    onClick={() => toggleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {active && (
                        <span className="text-[9px] text-blue-300">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center py-8 text-app-muted text-[13px]">
                  Sin campañas que coincidan con los filtros
                </td>
              </tr>
            ) : (
              sorted.map((c) => {
                const status = STATUS_PILL[c.status] || STATUS_PILL.SIN_ESTADO;
                const verdict = c._verdict ? VERDICT_PILL[c._verdict] : null;
                return (
                  <tr key={c.metaId} className="border-b border-white/[0.03] hover:bg-white/[0.015] transition">
                    {/* Estado */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10.5px] font-medium ${status.bg} ${status.text}`}>
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: status.dot }} />
                        {status.label}
                      </span>
                    </td>
                    {/* Campaña */}
                    <td className="py-3 px-4">
                      <p className="text-white font-medium leading-tight truncate max-w-[420px]" title={c.nombre}>{c.nombre}</p>
                      <p className="text-app-muted text-[10.5px] mt-0.5 leading-tight">
                        <span>{c.objective || 'sin objetivo'}</span>
                        <span className="mx-1.5 text-app-muted/50">·</span>
                        <span className="font-mono text-[10px]">{c.metaId}</span>
                      </p>
                    </td>
                    {/* Spend */}
                    <td className="py-3 px-4 text-center">
                      <p className="text-white tabular-nums">{c._spend > 0 ? fmtMoney(c._spend) : <span className="text-app-muted">—</span>}</p>
                    </td>
                    {/* % Spend con minibar */}
                    <td className="py-3 px-4">
                      {c._spend > 0 ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-12 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                            <div className="h-full bg-blue-400/70 rounded-full" style={{ width: `${Math.min(c._spendShare, 100)}%` }} />
                          </div>
                          <span className="text-app-secondary tabular-nums text-[11.5px] w-10 text-right">{c._spendShare.toFixed(1)}%</span>
                        </div>
                      ) : <p className="text-app-muted text-center">—</p>}
                    </td>
                    {/* Revenue */}
                    <td className="py-3 px-4 text-center">
                      <p className="text-emerald-300 tabular-nums">{c._revenue > 0 ? fmtMoney(c._revenue) : <span className="text-app-muted">—</span>}</p>
                    </td>
                    {/* ROAS */}
                    <td className="py-3 px-4 text-center">
                      <p className={`tabular-nums font-semibold ${roasTone(c._roas)}`}>
                        {c._spend > 0 ? fmtMultiple(c._roas) : <span className="text-app-muted font-normal">—</span>}
                      </p>
                    </td>
                    {/* Compras */}
                    <td className="py-3 px-4 text-center">
                      <p className="text-white tabular-nums">{c._purchases > 0 ? fmtNum(c._purchases) : <span className="text-app-muted">—</span>}</p>
                    </td>
                    {/* CPA */}
                    <td className="py-3 px-4 text-center">
                      <p className="text-app-secondary tabular-nums">{c._purchases > 0 ? fmtMoney(c._cpa) : <span className="text-app-muted">—</span>}</p>
                    </td>
                    {/* CPC */}
                    <td className="py-3 px-4 text-center">
                      <p className="text-app-secondary tabular-nums">{c._cpc > 0 ? fmtMoney(c._cpc) : <span className="text-app-muted">—</span>}</p>
                    </td>
                    {/* CTR */}
                    <td className="py-3 px-4 text-center">
                      <p className={`tabular-nums ${ctrTone(c._ctr)}`}>{c._impressions > 0 ? fmtPct(c._ctr) : <span className="text-app-muted">—</span>}</p>
                    </td>
                    {/* Alcance */}
                    <td className="py-3 px-4 text-center">
                      <p className="text-app-secondary tabular-nums">{c._reach > 0 ? fmtNum(c._reach) : <span className="text-app-muted">—</span>}</p>
                    </td>
                    {/* Frecuencia (con alerta de fatiga >2.5) */}
                    <td className="py-3 px-4 text-center">
                      {c._frequency > 0 ? (
                        <span
                          className={`tabular-nums font-semibold ${frequencyTone(c._frequency)}`}
                          title={c._frequency >= 3 ? 'Frecuencia alta — creativo quemado' : c._frequency >= 2.5 ? 'Frecuencia elevada — empieza fatiga' : 'Frecuencia saludable'}
                        >
                          {c._frequency.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-app-muted">—</span>
                      )}
                    </td>
                    {/* Hook Rate (video views / impressions) */}
                    <td className="py-3 px-4 text-center">
                      {c._videoViews > 0 ? (
                        <span
                          className={`tabular-nums ${hookRateTone(c._hookRate)}`}
                          title={
                            `${fmtNum(c._videoViews)} video views\n` +
                            `${fmtNum(c._videoViewsPct25)} llegaron al 25%\n` +
                            `${fmtNum(c._videoViewsPct50)} llegaron al 50%`
                          }
                        >
                          {fmtPct(c._hookRate, 1)}
                        </span>
                      ) : (
                        <span className="text-app-muted">—</span>
                      )}
                    </td>
                    {/* Veredicto */}
                    <td className="py-3 px-4 text-center">
                      {verdict ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-semibold ${verdict.bg} ${verdict.text}`}>
                          {verdict.label}
                        </span>
                      ) : (
                        <span className="text-app-muted text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
