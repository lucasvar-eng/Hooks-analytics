import { useState, useEffect, useMemo, useRef } from 'react';
import MetricCompleteness from '../common/MetricCompleteness';
import { MetaLogo, TiendanubeLogo, PnlLogo } from './SourceLogos';

const LOGO_BY_SOURCE = {
  meta: MetaLogo,
  tn: TiendanubeLogo,
  pnl: PnlLogo,
};

/**
 * Fila de KPIs agrupados por fuente (Meta, Tienda Nube, P&L).
 *
 * Props:
 *   sourceKey: 'meta' | 'tn' | 'pnl'
 *   title: string visible en el header
 *   subtitle: string chico bajo el título
 *   periodLabel: ej. "Últimos 7 días"
 *   availableMetrics: [{ key, defaultLabel, formatter, getValue(data), getDelta(data, deltas), getSub(data), coverageAware? }]
 *   data: objeto current con métricas (state.stores.metrics[storeId].current)
 *   deltas: objeto deltas (state.stores.metrics[storeId].deltas)
 *   coverage: costCoverage para badge "Preliminar"
 *   storeId: para link en el badge
 *   storageKey: para persistir selección + nombres custom en localStorage
 *   defaultSelected: array de keys que arrancan seleccionados
 *   maxSelected: número máximo de métricas (default 6)
 *   rightBadge?: jsx opcional a la derecha del header (ej. badge "Preliminar")
 */
export default function SourceMetricsRow({
  sourceKey,
  title,
  subtitle,
  periodLabel,
  availableMetrics,
  data,
  deltas,
  target,
  coverage,
  storeId,
  storageKey,
  defaultSelected,
  maxSelected = 6,
  rightBadge = null,
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState(() => loadSelected(storageKey, defaultSelected));
  const [customNames, setCustomNames] = useState(() => loadCustomNames(storageKey));
  const [customThresholds, setCustomThresholds] = useState(() => loadThresholds(storageKey));
  const [draftSelected, setDraftSelected] = useState(selected);
  const [draftCustomNames, setDraftCustomNames] = useState(customNames);
  const [draftThresholds, setDraftThresholds] = useState(customThresholds);
  const [renamingKey, setRenamingKey] = useState(null);
  const [renamingValue, setRenamingValue] = useState('');
  const [thresholdsForKey, setThresholdsForKey] = useState(null);

  // Solo reinicializar drafts en el flanco de subida (cerrado → abierto).
  // Si dependiéramos de selected/customNames/customThresholds, persistir
  // thresholds en vivo dispararía este efecto y cerraría el editor de umbrales
  // en cada keystroke.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (editOpen && !wasOpenRef.current) {
      setDraftSelected(selected);
      setDraftCustomNames(customNames);
      setDraftThresholds(customThresholds);
      setRenamingKey(null);
      setThresholdsForKey(null);
    }
    wasOpenRef.current = editOpen;
  }, [editOpen, selected, customNames, customThresholds]);

  const metricsByKey = useMemo(() => {
    const map = new Map();
    availableMetrics.forEach((m) => map.set(m.key, m));
    return map;
  }, [availableMetrics]);

  const visibleMetrics = selected
    .map((key) => metricsByKey.get(key))
    .filter(Boolean);

  const toggleDraft = (key) => {
    setDraftSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= maxSelected) return prev;
      return [...prev, key];
    });
  };

  const startRename = (key) => {
    setRenamingKey(key);
    setRenamingValue(draftCustomNames[key] || metricsByKey.get(key)?.defaultLabel || '');
  };

  const commitRename = () => {
    if (!renamingKey) return;
    const trimmed = renamingValue.trim();
    const original = metricsByKey.get(renamingKey)?.defaultLabel;
    setDraftCustomNames((prev) => {
      const next = { ...prev };
      if (!trimmed || trimmed === original) {
        delete next[renamingKey];
      } else {
        next[renamingKey] = trimmed;
      }
      return next;
    });
    setRenamingKey(null);
  };

  const cancelEdit = () => {
    setEditOpen(false);
  };

  const saveEdit = () => {
    setSelected(draftSelected);
    setCustomNames(draftCustomNames);
    setCustomThresholds(draftThresholds);
    saveSelected(storageKey, draftSelected);
    saveCustomNames(storageKey, draftCustomNames);
    saveThresholds(storageKey, draftThresholds);
    setEditOpen(false);
  };

  // Los thresholds se persisten en vivo: cada cambio actualiza tanto el draft
  // como el state real + localStorage. Distinto a la selección/nombres que
  // requieren confirmación con "Guardar" porque cambian el layout visible.
  const updateThreshold = (key, field, value) => {
    const apply = (prev) => {
      const next = { ...prev };
      const current = { ...(next[key] || {}) };
      let nextValue;
      if (field === 'invert') {
        nextValue = value ? true : null;
      } else {
        if (value === '' || value == null) {
          nextValue = null;
        } else {
          const n = Number(value);
          nextValue = Number.isFinite(n) ? n : null;
        }
      }
      if (nextValue == null) {
        delete current[field];
      } else {
        current[field] = nextValue;
      }
      const hasMeaningful = current.good != null || current.bad != null;
      if (!hasMeaningful) {
        delete next[key];
      } else {
        next[key] = current;
      }
      return next;
    };
    setDraftThresholds(apply);
    setCustomThresholds((prev) => {
      const updated = apply(prev);
      saveThresholds(storageKey, updated);
      return updated;
    });
  };

  const customCount = Object.keys(customNames).length;

  return (
    <div className="resumen-source-row">
      <div className="resumen-source-row__header">
        <div className="resumen-source-row__brand">
          <span className="resumen-source-row__brand-logo">
            {(() => {
              const Logo = LOGO_BY_SOURCE[sourceKey];
              return Logo ? <Logo size={28} /> : null;
            })()}
          </span>
          <div>
            <div className="resumen-source-row__brand-name">{title}</div>
            {subtitle && <div className="resumen-source-row__brand-sub">{subtitle}</div>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {rightBadge}
          {periodLabel && <span className="resumen-source-row__meta">{periodLabel}</span>}
          <button
            type="button"
            onClick={() => setEditOpen((v) => !v)}
            className="resumen-source-row__edit"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4H4v16h16v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            {editOpen ? 'Cerrar' : 'Editar métricas'}
          </button>
        </div>
      </div>

      {editOpen && (
        <div className="resumen-metrics-picker">
          <p className="resumen-metrics-picker__title">
            Elegí hasta {maxSelected} métricas · tocá el lápiz para renombrar
          </p>
          <div className="resumen-metrics-picker__grid">
            {availableMetrics.map((m) => {
              const isSelected = draftSelected.includes(m.key);
              const isAtCap = !isSelected && draftSelected.length >= maxSelected;
              const customLabel = draftCustomNames[m.key];
              const isRenaming = renamingKey === m.key;
              return (
                <div
                  key={m.key}
                  className={`resumen-metrics-picker__option ${isSelected ? 'is-selected' : ''} ${isAtCap ? 'is-disabled' : ''}`}
                  onClick={() => !isRenaming && !isAtCap && toggleDraft(m.key)}
                >
                  <span className="resumen-metrics-picker__check">{isSelected && '✓'}</span>
                  {isRenaming ? (
                    <input
                      autoFocus
                      type="text"
                      value={renamingValue}
                      onChange={(e) => setRenamingValue(e.target.value)}
                      onBlur={commitRename}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setRenamingKey(null);
                      }}
                      className="resumen-metrics-picker__input"
                    />
                  ) : (
                    <span className="flex-1 min-w-0 truncate">
                      {customLabel || m.defaultLabel}
                      {customLabel && <span className="resumen-metrics-picker__renamed-tag">(custom)</span>}
                    </span>
                  )}
                  {isSelected && !isRenaming && (
                    <div className="resumen-metrics-picker__actions">
                      {m.getTone && (
                        <button
                          type="button"
                          className="resumen-metrics-picker__threshold-btn"
                          onClick={(e) => { e.stopPropagation(); setThresholdsForKey(thresholdsForKey === m.key ? null : m.key); }}
                          title="Configurar umbrales de color"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 17l6-6 4 4 7-8M21 14v6m-3-3h6" />
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        className="resumen-metrics-picker__pencil"
                        onClick={(e) => { e.stopPropagation(); startRename(m.key); }}
                        title="Renombrar"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4H4v16h16v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {thresholdsForKey && (() => {
            const m = metricsByKey.get(thresholdsForKey);
            if (!m) return null;
            const t = draftThresholds[thresholdsForKey] || {};
            const label = draftCustomNames[thresholdsForKey] || m.defaultLabel;
            return (
              <div className="resumen-threshold-editor">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-app-secondary">
                    Umbrales de color · {label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setThresholdsForKey(null)}
                    className="text-[11px] text-gray-500 hover:text-gray-300"
                  >
                    Cerrar
                  </button>
                </div>
                <p className="text-[11px] text-app-secondary mb-3">
                  Definí cuándo la métrica se ve <span className="text-emerald-300">verde</span> (objetivo cumplido)
                  o <span className="text-red-300">roja</span> (alerta). Activá invertir si <em>bajar</em> es mejor (ej. CPA).
                  <span className="ml-1 text-emerald-400/70">Los cambios se aplican al instante.</span>
                </p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">Verde a partir de</span>
                    <input
                      type="number"
                      step="any"
                      value={t.good ?? ''}
                      onChange={(e) => updateThreshold(thresholdsForKey, 'good', e.target.value)}
                      placeholder="—"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-app-primary tabular-nums focus:outline-none focus:border-emerald-500/40"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 block mb-1">Rojo a partir de</span>
                    <input
                      type="number"
                      step="any"
                      value={t.bad ?? ''}
                      onChange={(e) => updateThreshold(thresholdsForKey, 'bad', e.target.value)}
                      placeholder="—"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-app-primary tabular-nums focus:outline-none focus:border-red-500/40"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-[12px] text-app-secondary">
                  <input
                    type="checkbox"
                    checked={!!t.invert}
                    onChange={(e) => updateThreshold(thresholdsForKey, 'invert', e.target.checked)}
                    className="accent-blue-500"
                  />
                  Invertir: valores bajos son mejores (ej. CPA, % NC)
                </label>
              </div>
            );
          })()}

          <div className="resumen-metrics-picker__footer">
            <span className="resumen-metrics-picker__counter">
              {draftSelected.length} de {maxSelected} seleccionadas
              {Object.keys(draftCustomNames).length > 0 && ` · ${Object.keys(draftCustomNames).length} con nombre custom`}
              {Object.keys(draftThresholds).length > 0 && ` · ${Object.keys(draftThresholds).length} con umbrales custom`}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={cancelEdit} className="text-[11px] text-gray-500 hover:text-gray-300 px-2">
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="text-[11px] font-semibold bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 px-3 py-1.5 rounded-lg"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="resumen-kpi-grid">
        {visibleMetrics.map((m) => {
          const value = m.getValue ? m.getValue(data, target) : '—';
          const delta = m.getDelta ? m.getDelta(data, deltas, target) : null;
          const sub = m.getSub ? m.getSub(data, target) : null;
          // Si el usuario configuró thresholds custom para esta métrica, usarlos.
          // Sino, caer en el getTone del catalog (thresholds default).
          const tone = customThresholds[m.key]
            ? applyCustomThreshold(m, data, target, customThresholds[m.key])
            : m.getTone ? m.getTone(data, target) : null;
          const label = customNames[m.key] || m.defaultLabel;
          return (
            <div key={m.key} className={`resumen-kpi ${tone ? `resumen-kpi--tone-${tone}` : ''}`}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="resumen-kpi__label">{label}</span>
                {m.coverageAware && coverage?.isPreliminary && (
                  <MetricCompleteness coverage={coverage} storeId={storeId} size="sm" />
                )}
              </div>
              <div className="resumen-kpi__value">{value}</div>
              {delta && delta.text !== '—' && (
                <span className={`resumen-kpi__delta resumen-kpi__delta--${delta.tone || 'neutral'}`}>
                  {delta.text}
                </span>
              )}
              {sub && <div className="resumen-kpi__sub">{sub}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function loadSelected(storageKey, defaults) {
  if (!storageKey) return defaults;
  try {
    const raw = localStorage.getItem(`${storageKey}:selected`);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaults;
  } catch {
    return defaults;
  }
}

function saveSelected(storageKey, value) {
  if (!storageKey) return;
  try { localStorage.setItem(`${storageKey}:selected`, JSON.stringify(value)); } catch {}
}

function loadCustomNames(storageKey) {
  if (!storageKey) return {};
  try {
    const raw = localStorage.getItem(`${storageKey}:names`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCustomNames(storageKey, value) {
  if (!storageKey) return;
  try { localStorage.setItem(`${storageKey}:names`, JSON.stringify(value)); } catch {}
}

function loadThresholds(storageKey) {
  if (!storageKey) return {};
  try {
    const raw = localStorage.getItem(`${storageKey}:thresholds`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveThresholds(storageKey, value) {
  if (!storageKey) return;
  try { localStorage.setItem(`${storageKey}:thresholds`, JSON.stringify(value)); } catch {}
}

/**
 * Aplica umbrales custom a la métrica. Necesita extraer el valor crudo
 * (no formateado) — todo getValue del catalog devuelve string formateado,
 * así que reutilizamos los raw fields de data según la métrica.
 */
function applyCustomThreshold(metric, data, target, thresholds) {
  if (!thresholds || !data) return null;
  const raw = extractRawValue(metric, data, target);
  if (raw == null || isNaN(raw)) return null;
  const { good, bad, invert } = thresholds;
  const v = Number(raw);
  if (invert) {
    if (good != null && v <= good) return 'good';
    if (bad != null && v >= bad) return 'bad';
    return null;
  }
  if (good != null && v >= good) return 'good';
  if (bad != null && v <= bad) return 'bad';
  return null;
}

// Mapea metric.key → field crudo en data para el threshold custom.
// Si la métrica no está acá, el threshold custom no aplica (caen al getTone del catalog).
const RAW_FIELD_BY_KEY = {
  adSpend: (d) => d?.adSpend,
  metaRevenue: (d) => d?.metaPurchaseValue || d?.revenue,
  roas: (d) => d?.roas,
  cpa: (d) => d?.cpa,
  metaPurchases: (d) => d?.metaPurchases,
  ctr: (d) => d?.ctr,
  cpc: (d) => d?.cpc,
  cpm: (d) => d?.cpm,
  revenue: (d) => d?.revenue,
  ordenes: (d) => d?.ordenesPositivas || d?.ordenes,
  aov: (d) => d?.aov,
  aovNeto: (d) => d?.aovNeto,
  cvr: (d) => d?.conversionRate,
  ncPct: (d) => d?.ncPct,
  netRevenue: (d) => d?.netRevenue,
  profit: (d) => d?.officialProfit ?? d?.adjustedProfit,
  profitMarginNeto: (d) => d?.officialProfitMargin ?? d?.adjustedProfitMargin,
  profitMarginBruto: (d) => d?.profitMargin,
  trueRoasPnl: (d) => d?.officialTrueRoas ?? d?.trueRoas,
};

function extractRawValue(metric, data, target) {
  const extractor = RAW_FIELD_BY_KEY[metric.key];
  return extractor ? extractor(data) : null;
}
