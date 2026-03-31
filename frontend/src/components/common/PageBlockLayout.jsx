import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

function createSlot(blockId, seed = Date.now()) {
  return {
    instanceId: `${blockId}-${seed}-${Math.random().toString(36).slice(2, 8)}`,
    blockId,
  };
}

function getBlockId(slot) {
  if (!slot) return null;
  if (typeof slot === 'string') return slot;
  return slot.blockId || null;
}

function getSlotInstanceId(slot, index = 0) {
  if (!slot) return null;
  if (typeof slot === 'object' && slot.instanceId) return slot.instanceId;
  const blockId = getBlockId(slot);
  return blockId ? `${blockId}-legacy-${index}` : null;
}

function getDefaultSlots(blocks) {
  return blocks
    .filter((block) => block.defaultEnabled !== false)
    .map((block, index) => ({
      instanceId: `${block.id}-default-${index}`,
      blockId: block.id,
    }));
}

function normalizeSlots(blocks, rawSlots, initiallyEmpty = false) {
  const blockMap = new Map(blocks.map((block) => [block.id, block]));
  const seenNonRepeatable = new Set();
  const normalized = [];

  if (Array.isArray(rawSlots)) {
    rawSlots.forEach((slot, index) => {
      if (slot == null) {
        normalized.push(null);
        return;
      }

      const blockId = getBlockId(slot);
      const block = blockMap.get(blockId);
      if (!block) return;

      if (!block.repeatable && seenNonRepeatable.has(blockId)) {
        return;
      }

      if (!block.repeatable) {
        seenNonRepeatable.add(blockId);
      }

      normalized.push({
        instanceId: getSlotInstanceId(slot, index),
        blockId,
      });
    });

    return normalized;
  }

  return initiallyEmpty ? [] : getDefaultSlots(blocks);
}

function normalizeBlockConfig(blocks, normalizedSlots, rawConfig) {
  const config = {};
  normalizedSlots.forEach((slot) => {
    if (!slot) return;
    const block = blocks.find((item) => item.id === slot.blockId);
    const legacyConfig = rawConfig?.[slot.instanceId] || rawConfig?.[slot.blockId] || {};
    config[slot.instanceId] = {
      ...(block?.defaultConfig || {}),
      ...legacyConfig,
    };
  });
  return config;
}

function getBlockSpan(size = 'full') {
  switch (size) {
    case 'third':
      return 'xl:col-span-4';
    case 'half':
      return 'xl:col-span-6';
    case 'wide':
      return 'xl:col-span-8';
    case 'full':
    default:
      return 'xl:col-span-12';
  }
}

function buildPresetSlots(blocks, predicate) {
  return blocks
    .filter(predicate)
    .map((block, index) => ({
      instanceId: `${block.id}-preset-${index}`,
      blockId: block.id,
  }));
}

function BlockLibraryPreview({ block }) {
  const previewType = block.previewType || (
    block.id.includes('kpi') ? 'kpi'
      : block.id.includes('comparison') ? 'comparison'
        : block.id.includes('table') ? 'table'
          : block.id.includes('chart') ? 'chart'
            : block.id.includes('donut') ? 'donut'
              : block.id.includes('heatmap') ? 'heatmap'
                : block.id.includes('insight') ? 'insight'
                  : block.id.includes('checklist') ? 'list'
                    : 'note'
  );

  if (previewType === 'kpi') {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
        <div className="h-2.5 w-14 rounded-full bg-white/[0.16]" />
        <div className="mt-3 h-8 w-24 rounded-lg bg-white/[0.12]" />
        <div className="mt-4 h-2 w-20 rounded-full bg-white/[0.08]" />
      </div>
    );
  }

  if (previewType === 'comparison') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
          <div className="h-2 w-10 rounded-full bg-white/[0.14]" />
          <div className="mt-3 h-6 w-16 rounded-lg bg-white/[0.12]" />
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
          <div className="h-2 w-10 rounded-full bg-white/[0.14]" />
          <div className="mt-3 h-6 w-16 rounded-lg bg-white/[0.08]" />
        </div>
      </div>
    );
  }

  if (previewType === 'table') {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
        <div className="grid grid-cols-4 gap-2">
          {[...Array(4)].map((_, index) => <div key={index} className="h-2 rounded-full bg-white/[0.14]" />)}
        </div>
        <div className="mt-3 space-y-2">
          {[...Array(3)].map((_, row) => (
            <div key={row} className="grid grid-cols-4 gap-2">
              {[...Array(4)].map((__, cell) => <div key={cell} className="h-2 rounded-full bg-white/[0.07]" />)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (previewType === 'chart') {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
        <div className="flex items-end gap-2 h-[82px]">
          {[34, 52, 30, 68, 48, 72].map((height, index) => (
            <div key={index} className="flex-1 rounded-t-md bg-white/[0.10]" style={{ height }} />
          ))}
        </div>
      </div>
    );
  }

  if (previewType === 'donut') {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3 flex items-center justify-center h-[112px]">
        <div className="h-20 w-20 rounded-full" style={{ background: 'conic-gradient(#60a5fa 0deg 160deg, #f472b6 160deg 260deg, #34d399 260deg 360deg)' }}>
          <div className="h-9 w-9 rounded-full bg-[#171717] mx-auto mt-[22px]" />
        </div>
      </div>
    );
  }

  if (previewType === 'heatmap') {
    return (
      <div className="grid grid-cols-4 gap-2">
        {[0.22, 0.38, 0.52, 0.72, 0.18, 0.43, 0.64, 0.3].map((alpha, index) => (
          <div key={index} className="h-10 rounded-lg border border-white/[0.05]" style={{ backgroundColor: `rgba(244,57,176,${alpha})` }} />
        ))}
      </div>
    );
  }

  if (previewType === 'insight') {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3 flex gap-3">
        <div className="h-8 w-8 rounded-xl bg-white/[0.08] shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-24 rounded-full bg-white/[0.16]" />
          <div className="h-2 w-full rounded-full bg-white/[0.08]" />
          <div className="h-2 w-4/5 rounded-full bg-white/[0.08]" />
        </div>
      </div>
    );
  }

  if (previewType === 'list') {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3 space-y-2">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
            <div className="h-2 w-full rounded-full bg-white/[0.08]" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <div className="h-2.5 w-24 rounded-full bg-white/[0.18]" />
      <div className="mt-3 h-7 w-20 rounded-lg bg-white/[0.10]" />
      <div className="mt-4 space-y-2">
        <div className="h-2 w-full rounded-full bg-white/[0.06]" />
        <div className="h-2 w-4/5 rounded-full bg-white/[0.06]" />
        <div className="h-2 w-3/5 rounded-full bg-white/[0.06]" />
      </div>
    </div>
  );
}

function BlockLibraryCard({ block, onAdd }) {
  const fields = Array.isArray(block.configFields) ? block.configFields.length : typeof block.configFields === 'function' ? 'dyn' : 0;

  return (
    <button
      onClick={() => onAdd(block.id)}
      className="text-left rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] transition p-4 min-h-[148px] flex flex-col"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-app-muted">
          {block.category || 'Bloque'}
        </span>
        {block.repeatable ? (
          <span className="text-[10px] text-emerald-300">Repetible</span>
        ) : null}
      </div>

      <div className="mt-3 flex-1">
        <BlockLibraryPreview block={block} />
      </div>

      <div className="mt-3">
        <p className="text-white text-[14px] font-semibold">{block.label}</p>
        <p className="text-app-secondary text-[12px] mt-1">
          {fields === 'dyn'
            ? 'Campos dinámicos según la hoja'
            : fields > 0
              ? `${fields} campos configurables`
              : 'Bloque simple listo para usar'}
        </p>
      </div>
    </button>
  );
}

function BlockConfigPanel({
  block,
  instanceId,
  config,
  context,
  onChange,
  onClearStyles,
}) {
  const rawFields = typeof block.configFields === 'function' ? block.configFields(context) : block.configFields;
  const customFields = Array.isArray(rawFields) ? rawFields : [];

  return (
    <div className="mt-2 rounded-2xl border border-white/[0.08] bg-[#111111] p-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[1.4px] text-gray-400">Título del bloque</span>
          <input
            type="text"
            value={config.title || ''}
            onChange={(e) => onChange(instanceId, { title: e.target.value })}
            className="input-dark mt-1"
            placeholder={block.label}
          />
        </label>

        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[1.4px] text-gray-400">Tamaño</span>
          <select
            value={config.size || 'full'}
            onChange={(e) => onChange(instanceId, { size: e.target.value })}
            className="input-dark mt-1"
          >
            <option value="full">Ancho completo</option>
            <option value="wide">Ancho grande</option>
            <option value="half">Mitad</option>
            <option value="third">Tercio</option>
          </select>
        </label>
      </div>

      <label className="block mt-4">
        <span className="text-[10px] font-bold uppercase tracking-[1.4px] text-gray-400">Descripción / nota</span>
        <textarea
          rows={3}
          value={config.description || ''}
          onChange={(e) => onChange(instanceId, { description: e.target.value })}
          className="input-dark mt-1"
          placeholder="Texto corto opcional para copete, ayuda o contexto."
        />
      </label>

      <div className="mt-4 flex items-center gap-2">
        <input
          id={`show-title-${instanceId}`}
          type="checkbox"
          checked={Boolean(config.showTitle)}
          onChange={(e) => onChange(instanceId, { showTitle: e.target.checked })}
        />
        <label htmlFor={`show-title-${instanceId}`} className="text-[12px] text-app-secondary">
          Mostrar título arriba del bloque
        </label>
      </div>

      {customFields.length > 0 && (
        <div className="mt-4 space-y-4 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-gray-400">Contenido del bloque</p>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {customFields.map((field) => {
              const value = config?.[field.key] ?? field.defaultValue ?? '';
              const label = (
                <span className="text-[10px] font-bold uppercase tracking-[1.4px] text-gray-400">{field.label}</span>
              );

              if (field.type === 'textarea') {
                return (
                  <label key={field.key} className={field.fullWidth ? 'xl:col-span-2 block' : 'block'}>
                    {label}
                    <textarea
                      rows={field.rows || 4}
                      value={value}
                      onChange={(e) => onChange(instanceId, { [field.key]: e.target.value })}
                      className="input-dark mt-1"
                      placeholder={field.placeholder || ''}
                    />
                  </label>
                );
              }

              if (field.type === 'select') {
                return (
                  <label key={field.key} className="block">
                    {label}
                    <select
                      value={value}
                      onChange={(e) => onChange(instanceId, { [field.key]: e.target.value })}
                      className="input-dark mt-1"
                    >
                      {(field.options || []).map((option) => {
                        const optionValue = typeof option === 'string' ? option : option.value;
                        const optionLabel = typeof option === 'string' ? option : option.label;
                        return (
                          <option key={optionValue} value={optionValue}>
                            {optionLabel}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                );
              }

              return (
                <label key={field.key} className="block">
                  {label}
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={value}
                    onChange={(e) => onChange(instanceId, {
                      [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value,
                    })}
                    className="input-dark mt-1"
                    placeholder={field.placeholder || ''}
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-3">
        {[
          ['Fondo', 'bgColor', config.bgColor || '#161616'],
          ['Borde', 'borderColor', config.borderColor || '#2b2b2b'],
          ['Texto', 'textColor', config.textColor || '#f5f5f5'],
        ].map(([label, key, value]) => (
          <label key={key} className="block">
            <span className="text-[10px] font-bold uppercase tracking-[1.4px] text-gray-400">{label}</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={String(value)}
                onChange={(e) => onChange(instanceId, { [key]: e.target.value })}
                className="h-10 w-12 rounded-lg border border-white/[0.08] bg-transparent p-1 cursor-pointer"
              />
              <input
                type="text"
                value={String(value)}
                onChange={(e) => onChange(instanceId, { [key]: e.target.value })}
                className="input-dark w-full"
              />
            </div>
          </label>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <button onClick={() => onClearStyles(instanceId)} className="btn-ghost text-[11px]">
          Limpiar estilos
        </button>
      </div>
    </div>
  );
}

export default function PageBlockLayout({
  storeId,
  pageKey,
  storeLayouts,
  blocks,
  initiallyEmpty = false,
  blockContext = {},
  presetTemplates = [],
}) {
  const [editMode, setEditMode] = useState(false);
  const [slots, setSlots] = useState(() => normalizeSlots(blocks, storeLayouts?.[pageKey]?.slots, initiallyEmpty));
  const [blockConfig, setBlockConfig] = useState(() =>
    normalizeBlockConfig(blocks, normalizeSlots(blocks, storeLayouts?.[pageKey]?.slots, initiallyEmpty), storeLayouts?.[pageKey]?.blockConfig)
  );
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryFilter, setLibraryFilter] = useState('all');

  useEffect(() => {
    const normalizedSlots = normalizeSlots(blocks, storeLayouts?.[pageKey]?.slots, initiallyEmpty);
    setSlots(normalizedSlots);
    setBlockConfig(normalizeBlockConfig(blocks, normalizedSlots, storeLayouts?.[pageKey]?.blockConfig));
  }, [blocks, initiallyEmpty, pageKey, storeLayouts]);

  const blockMap = useMemo(() => new Map(blocks.map((block) => [block.id, block])), [blocks]);
  const availableBlocks = useMemo(() => {
    const presentIds = slots.map(getBlockId).filter(Boolean);
    return blocks.filter((block) => block.repeatable || !presentIds.includes(block.id));
  }, [blocks, slots]);

  const libraryCategories = useMemo(() => {
    return ['all', ...new Set(availableBlocks.map((block) => block.category || 'Bloques'))];
  }, [availableBlocks]);

  const filteredAvailableBlocks = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    return availableBlocks.filter((block) => {
      const inCategory = libraryFilter === 'all' || (block.category || 'Bloques') === libraryFilter;
      if (!inCategory) return false;
      if (!query) return true;
      return [
        block.label,
        block.category,
        block.id,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
    });
  }, [availableBlocks, libraryFilter, libraryQuery]);

  const groupedAvailableBlocks = useMemo(() => {
    return filteredAvailableBlocks.reduce((acc, block) => {
      const category = block.category || 'Bloques';
      acc[category] = acc[category] || [];
      acc[category].push(block);
      return acc;
    }, {});
  }, [filteredAvailableBlocks]);

  const presets = useMemo(() => ([
    {
      id: 'blank',
      label: 'Hoja vacía',
      helper: 'Empezar desde cero',
      slots: [],
    },
    {
      id: 'base',
      label: 'Base sugerida',
      helper: 'Bloques principales',
      slots: getDefaultSlots(blocks),
    },
    {
      id: 'analytic',
      label: 'Solo analítica',
      helper: 'Sin IA ni utilidades',
      slots: buildPresetSlots(blocks, (block) => !['IA', 'Utilidad'].includes(block.category)),
    },
    {
      id: 'utility',
      label: 'Libre / editorial',
      helper: 'Solo bloques manuales',
      slots: buildPresetSlots(blocks, (block) => ['Utilidad', 'Analítica libre', 'Analítica universal'].includes(block.category)),
    },
    ...presetTemplates.map((preset, index) => ({
      id: preset.id || `custom-${index}`,
      label: preset.label,
      helper: preset.helper,
      slots: buildPresetSlots(blocks, (block) => (preset.blockIds || []).includes(block.id)),
    })),
  ]), [blocks, presetTemplates]);

  const moveBlock = (fromIndex, toIndex) => {
    if (fromIndex == null || toIndex == null || fromIndex === toIndex) return;
    setSlots((prev) => {
      const next = [...prev];
      const target = next[toIndex];
      next[toIndex] = next[fromIndex];
      next[fromIndex] = target ?? null;
      return next;
    });
  };

  const removeBlock = (instanceId) => {
    setSlots((prev) => prev.map((slot) => (getSlotInstanceId(slot) === instanceId ? null : slot)));
    setBlockConfig((prev) => {
      const next = { ...prev };
      delete next[instanceId];
      return next;
    });
    setEditingBlockId((prev) => (prev === instanceId ? null : prev));
  };

  const addBlock = (blockId) => {
    const block = blockMap.get(blockId);
    const slot = createSlot(blockId);
    setSlots((prev) => {
      const next = [...prev];
      const emptyIndex = next.findIndex((item) => item == null);
      if (emptyIndex >= 0) {
        next[emptyIndex] = slot;
        return next;
      }
      return [...next, slot];
    });
    setBlockConfig((prev) => ({
      ...prev,
      [slot.instanceId]: {
        ...(block?.defaultConfig || {}),
      },
    }));
  };

  const updateBlockConfig = (instanceId, patch) => {
    setBlockConfig((prev) => ({
      ...prev,
      [instanceId]: {
        ...(prev?.[instanceId] || {}),
        ...patch,
      },
    }));
  };

  const clearBlockStyle = (instanceId) => {
    setBlockConfig((prev) => ({
      ...prev,
      [instanceId]: {
        ...(prev?.[instanceId] || {}),
        bgColor: '',
        borderColor: '',
        textColor: '',
      },
    }));
  };

  const saveLayout = async (nextSlots, nextConfig = blockConfig) => {
    setSaving(true);
    try {
      await api.put(`/api/stores/${storeId}`, {
        [`pageLayouts.${pageKey}`]: { slots: nextSlots, blockConfig: nextConfig },
      });
    } catch {}
    setSaving(false);
  };

  const handleToggleEdit = async () => {
    if (editMode) {
      await saveLayout(slots, blockConfig);
      setEditingBlockId(null);
    }
    setEditMode((prev) => !prev);
  };

  const handleReset = async () => {
    const next = getDefaultSlots(blocks);
    const nextConfig = normalizeBlockConfig(blocks, next, {});
    setSlots(next);
    setBlockConfig(nextConfig);
    await saveLayout(next, nextConfig);
    setEditMode(false);
    setEditingBlockId(null);
  };

  const addEmptySlot = () => setSlots((prev) => [...prev, null]);
  const compactSlots = () => setSlots((prev) => normalizeSlots(blocks, prev.filter((item) => item != null)));
  const clearLayout = () => {
    setSlots([]);
    setBlockConfig({});
    setEditingBlockId(null);
  };

  const applyPreset = (preset) => {
    const nextSlots = normalizeSlots(blocks, preset.slots, false);
    const nextConfig = normalizeBlockConfig(blocks, nextSlots, {});
    setSlots(nextSlots);
    setBlockConfig(nextConfig);
    setEditingBlockId(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Constructor de hoja</p>
          <p className="text-app-secondary text-[12px] mt-1">
            Armá la hoja desde cero o reordená la que ya existe. Cada bloque puede cambiar título, tamaño y colores.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editMode && (
            <>
              <button onClick={addEmptySlot} className="btn-secondary text-[11px]">+ Hueco</button>
              <button onClick={clearLayout} className="btn-ghost text-[11px]">Vaciar</button>
              <button onClick={compactSlots} className="btn-ghost text-[11px]">Compactar</button>
              <button onClick={handleReset} className="btn-ghost text-[11px]">Resetear</button>
            </>
          )}
          <button onClick={handleToggleEdit} disabled={saving} className="btn-primary text-[11px] disabled:opacity-50">
            {saving ? 'Guardando...' : editMode ? 'Guardar hoja' : 'Editar hoja'}
          </button>
        </div>
      </div>

      {editMode && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
          <div>
            <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Biblioteca de bloques</p>
            <p className="text-app-secondary text-[12px] mt-1">
              Combiná bloques analíticos con bloques libres. Si querés arrancar desde cero, usá `Vaciar`.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-gray-400">Presets rápidos</p>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className="text-left rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] transition p-3"
                >
                  <p className="text-white text-[13px] font-semibold">{preset.label}</p>
                  <p className="text-app-secondary text-[11px] mt-1">{preset.helper}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr),220px] gap-3">
            <input
              type="text"
              value={libraryQuery}
              onChange={(e) => setLibraryQuery(e.target.value)}
              className="input-dark"
              placeholder="Buscar bloque por nombre o categoría..."
            />
            <select
              value={libraryFilter}
              onChange={(e) => setLibraryFilter(e.target.value)}
              className="input-dark"
            >
              {libraryCategories.map((category) => (
                <option key={category} value={category}>
                  {category === 'all' ? 'Todas las categorías' : category}
                </option>
              ))}
            </select>
          </div>

          {Object.entries(groupedAvailableBlocks).length === 0 ? (
            <span className="text-[12px] text-app-secondary">Todos los bloques disponibles ya están usados en esta hoja.</span>
          ) : (
            Object.entries(groupedAvailableBlocks).map(([category, categoryBlocks]) => (
              <div key={category} className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[1.4px] text-gray-400">{category}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
                  {categoryBlocks.map((block) => (
                    <BlockLibraryCard
                      key={block.id}
                      block={block}
                      onAdd={addBlock}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {slots.length === 0 && !editMode ? (
        <div className="rounded-2xl border border-dashed border-white/[0.10] bg-white/[0.02] px-4 py-10 text-center">
          <p className="text-white text-sm font-semibold">Esta hoja está vacía</p>
          <p className="text-app-secondary text-[12px] mt-2">Entrá en `Editar hoja` para construirla desde la biblioteca.</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        {slots.map((slot, index) => {
          const blockId = getBlockId(slot);
          const block = blockId ? blockMap.get(blockId) : null;
          const instanceId = getSlotInstanceId(slot, index);
          const config = instanceId ? (blockConfig?.[instanceId] || {}) : {};
          const showCustomTitle = Boolean(config.showTitle && (config.title || block?.label));
          const wrapperStyle = block ? {
            backgroundColor: config.bgColor || undefined,
            borderColor: config.borderColor || undefined,
            color: config.textColor || undefined,
          } : undefined;

          if (!block) {
            return (
              <div
                key={`empty-${index}`}
                onDragOver={(e) => {
                  if (!editMode) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!editMode) return;
                  e.preventDefault();
                  moveBlock(dragIndex, index);
                  setDragIndex(null);
                }}
                className={`xl:col-span-12 rounded-2xl border border-dashed px-4 py-6 text-center transition ${
                  editMode
                    ? 'border-white/[0.14] bg-white/[0.02] text-app-secondary'
                    : 'border-transparent bg-transparent text-transparent min-h-[18px]'
                }`}
              >
                {editMode ? 'Hueco vacío' : ' '}
              </div>
            );
          }

          return (
            <div
              key={instanceId}
              draggable={editMode}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => {
                if (!editMode) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                if (!editMode) return;
                e.preventDefault();
                moveBlock(dragIndex, index);
                setDragIndex(null);
              }}
              className={`${getBlockSpan(config.size || 'full')} ${editMode ? 'relative rounded-2xl ring-1 ring-blue-500/20 cursor-move' : ''}`}
            >
              {editMode && (
                <div className="absolute left-3 right-3 top-3 z-10 flex items-center justify-between gap-2">
                  <div className="rounded-full border border-blue-500/25 bg-[#0f172a]/90 px-2.5 py-1 text-[10px] font-semibold text-blue-200 shadow">
                    Arrastrar · {block.label}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingBlockId((prev) => (prev === instanceId ? null : instanceId));
                      }}
                      className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white shadow"
                    >
                      Editar
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeBlock(instanceId);
                      }}
                      className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold text-red-200 shadow"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              )}

              <div className={`rounded-2xl border border-transparent ${editMode ? 'pt-10' : ''}`} style={wrapperStyle}>
                {showCustomTitle && (
                  <div className="px-4 pt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: config.textColor || undefined }}>
                      {config.title || block.label}
                    </p>
                    {config.description && (
                      <p className="mt-2 text-[12px]" style={{ color: config.textColor || undefined }}>
                        {config.description}
                      </p>
                    )}
                  </div>
                )}
                <div className={showCustomTitle ? 'pt-2' : ''}>
                  {typeof block.render === 'function'
                    ? block.render({ config, instanceId, context: blockContext })
                    : block.content}
                </div>
              </div>

              {editMode && editingBlockId === instanceId && (
                <BlockConfigPanel
                  block={block}
                  instanceId={instanceId}
                  config={config}
                  context={blockContext}
                  onChange={updateBlockConfig}
                  onClearStyles={clearBlockStyle}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
