import { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Layout que permite reordenar bloques arrastrándolos.
 *
 * Funcionamiento:
 *  - Cada bloque tiene un `id` estable y un `node` (lo que se renderiza).
 *  - Botón "Reordenar" arriba activa el modo edit. En modo edit aparece un
 *    handle (⋮⋮) en la esquina superior izquierda de cada bloque y el bloque
 *    se vuelve draggable.
 *  - HTML5 drag & drop nativo (sin libs).
 *  - Persistencia en localStorage por `storageKey`. Si el storage tiene IDs que
 *    ya no existen en `items`, se ignoran. Items nuevos van al final.
 *  - Botón "Restaurar orden original" para volver al default.
 *
 * Props:
 *   items: [{ id: string, node: ReactNode, label?: string }]
 *   storageKey: string para localStorage
 *   defaultOrder?: array de ids (si no se pasa, usa el orden recibido)
 *   className?: clase aplicada al contenedor (ej. 'space-y-5')
 *   gap?: tailwind gap class (default 'gap-5')
 */
export default function SortableLayout({
  items,
  storageKey,
  defaultOrder,
  className = 'space-y-5',
}) {
  const defaultIds = useMemo(
    () => defaultOrder || items.map((it) => it.id),
    [defaultOrder, items],
  );

  const [order, setOrder] = useState(() => loadOrder(storageKey, defaultIds));
  const [editMode, setEditMode] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [overId, setOverId] = useState(null);
  // Cuando items cambian (nuevos ids), agregar al final
  useEffect(() => {
    const known = new Set(order);
    const newIds = items.map((it) => it.id);
    const missing = newIds.filter((id) => !known.has(id));
    const filtered = order.filter((id) => newIds.includes(id));
    if (missing.length > 0 || filtered.length !== order.length) {
      const next = [...filtered, ...missing];
      setOrder(next);
      saveOrder(storageKey, next);
    }
  }, [items, order, storageKey]);

  const itemById = useMemo(() => {
    const m = new Map();
    items.forEach((it) => m.set(it.id, it));
    return m;
  }, [items]);

  const orderedItems = order.map((id) => itemById.get(id)).filter(Boolean);

  const handleDragStart = (e, id) => {
    setDraggingId(id);
    // setData es OBLIGATORIO en Firefox y algunos navegadores para que dispare
    // los siguientes eventos (dragover, drop). Sin esto el drag empieza pero
    // el browser cancela todo silenciosamente.
    try { e.dataTransfer.setData('text/plain', id); } catch {}
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== overId) setOverId(id);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setOverId(null);
      return;
    }
    const next = [...order];
    const fromIdx = next.indexOf(draggingId);
    const toIdx = next.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, draggingId);
    setOrder(next);
    saveOrder(storageKey, next);
    setDraggingId(null);
    setOverId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setOverId(null);
  };

  const restoreDefault = () => {
    setOrder(defaultIds);
    saveOrder(storageKey, defaultIds);
  };

  const isCustomOrder = useMemo(() => {
    if (order.length !== defaultIds.length) return true;
    for (let i = 0; i < order.length; i++) {
      if (order[i] !== defaultIds[i]) return true;
    }
    return false;
  }, [order, defaultIds]);

  return (
    <div>
      {/* Barra de control */}
      <div className="flex items-center justify-end gap-2 mb-3">
        {editMode && isCustomOrder && (
          <button
            type="button"
            onClick={restoreDefault}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] hover:border-white/20 px-3 py-1.5 text-[11.5px] font-medium text-gray-200 hover:text-white transition"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4v6h6M21 20v-6h-6M21 4l-7 7M3 20l7-7" />
            </svg>
            Restaurar orden original
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditMode((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition
            ${editMode
              ? 'bg-blue-500/15 border-blue-500/40 text-blue-200 hover:bg-blue-500/25'
              : 'bg-white/[0.04] border-white/[0.08] text-gray-200 hover:border-white/20 hover:text-white'}`}
        >
          {editMode ? (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
              Listo
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              Reordenar
            </>
          )}
        </button>
      </div>

      <div className={`${editMode ? 'pl-11 transition-[padding] duration-200' : 'pl-0 transition-[padding] duration-200'} ${className}`}>
      {orderedItems.map((item) => {
        const isDragging = draggingId === item.id;
        const isOver = overId === item.id && draggingId && draggingId !== item.id;
        return (
          <div
            key={item.id}
            className={`relative transition-all duration-150
              ${isDragging ? 'opacity-40' : ''}
              ${isOver ? 'ring-2 ring-blue-500/60 ring-offset-2 ring-offset-[#0a0a0b] rounded-2xl' : ''}`}
          >
            {/* Contenido normal del bloque (sin interferir con events) */}
            <div className={editMode ? 'select-none' : ''}>
              {item.node}
            </div>

            {/* Overlay draggable: solo en modo edit, captura mouse y drag events */}
            {editMode && (
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDrop={(e) => handleDrop(e, item.id)}
                onDragEnd={handleDragEnd}
                className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing rounded-2xl bg-blue-500/[0.02] hover:bg-blue-500/[0.06] transition"
                title={item.label ? `Arrastrar "${item.label}"` : 'Arrastrar bloque'}
              >
                {/* Handle visual (fuera del card a la izquierda) */}
                <div
                  className="absolute -left-9 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/45 text-blue-200 shadow-md pointer-events-none"
                  aria-hidden
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="8" cy="6" r="1.5" /><circle cx="8" cy="12" r="1.5" /><circle cx="8" cy="18" r="1.5" />
                    <circle cx="16" cy="6" r="1.5" /><circle cx="16" cy="12" r="1.5" /><circle cx="16" cy="18" r="1.5" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}

function loadOrder(storageKey, defaults) {
  if (!storageKey) return defaults;
  try {
    const raw = localStorage.getItem(`${storageKey}:order`);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaults;
  } catch {
    return defaults;
  }
}

function saveOrder(storageKey, value) {
  if (!storageKey) return;
  try { localStorage.setItem(`${storageKey}:order`, JSON.stringify(value)); } catch {}
}
