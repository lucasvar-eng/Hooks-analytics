import { useState, useEffect, useMemo } from 'react';
import MetricCompleteness from '../common/MetricCompleteness';

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
  const [draftSelected, setDraftSelected] = useState(selected);
  const [draftCustomNames, setDraftCustomNames] = useState(customNames);
  const [renamingKey, setRenamingKey] = useState(null);
  const [renamingValue, setRenamingValue] = useState('');

  useEffect(() => {
    if (editOpen) {
      setDraftSelected(selected);
      setDraftCustomNames(customNames);
      setRenamingKey(null);
    }
  }, [editOpen, selected, customNames]);

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
    saveSelected(storageKey, draftSelected);
    saveCustomNames(storageKey, draftCustomNames);
    setEditOpen(false);
  };

  const customCount = Object.keys(customNames).length;

  return (
    <div className="resumen-source-row">
      <div className="resumen-source-row__header">
        <div className="resumen-source-row__brand">
          <span className={`resumen-source-row__brand-icon resumen-source-row__brand-icon--${sourceKey}`}>
            {sourceKey === 'meta' ? 'M' : sourceKey === 'tn' ? 'TN' : '$'}
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
                  )}
                </div>
              );
            })}
          </div>
          <div className="resumen-metrics-picker__footer">
            <span className="resumen-metrics-picker__counter">
              {draftSelected.length} de {maxSelected} seleccionadas
              {Object.keys(draftCustomNames).length > 0 && ` · ${Object.keys(draftCustomNames).length} con nombre custom`}
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
          const label = customNames[m.key] || m.defaultLabel;
          return (
            <div key={m.key} className="resumen-kpi">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="resumen-kpi__label">{label}</span>
                {m.coverageAware && coverage?.isPreliminary && (
                  <MetricCompleteness coverage={coverage} storeId={storeId} size="sm" />
                )}
              </div>
              <div className="resumen-kpi__value">{value}</div>
              {delta && (
                <div className={`resumen-kpi__delta resumen-kpi__delta--${delta.tone || 'neutral'}`}>
                  {delta.text}
                </div>
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
