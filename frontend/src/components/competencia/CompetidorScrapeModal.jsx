import { useEffect, useState } from 'react';

/**
 * Modal que muestra el resultado del scrape de la URL del competidor con
 * sugerencias auto-extraídas. El usuario marca qué campos aplicar (checkboxes)
 * y confirma. Por default solo se aplica a campos vacíos — para sobreescribir
 * un campo con valor hay que marcar "Forzar sobreescritura".
 *
 * Props:
 *   open: bool
 *   loading: bool
 *   error: string | null
 *   data: { url, fetchedAt, parsed, suggestions } | null
 *   competitor: doc actual del competidor (para detectar si los campos están vacíos)
 *   onClose: ()
 *   onApply: ({ updates, force }) => Promise
 */

const FIELD_LABELS = {
  positioning: 'Posicionamiento',
  mainOffer: 'Oferta principal',
};

function isEmpty(v) {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim().length === 0;
  return false;
}

export default function CompetidorScrapeModal({
  open,
  loading,
  error,
  data,
  competitor,
  onClose,
  onApply,
}) {
  const [selected, setSelected] = useState({});
  const [force, setForce] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!data?.suggestions) return setSelected({});
    // Por default marcar solo los campos vacíos del competidor actual
    const init = {};
    for (const key of Object.keys(data.suggestions)) {
      const current = competitor?.[key];
      init[key] = isEmpty(current);
    }
    setSelected(init);
  }, [data, competitor]);

  if (!open) return null;

  const suggestions = data?.suggestions || {};
  const parsed = data?.parsed || {};

  const handleToggle = (key) => {
    setSelected((s) => ({ ...s, [key]: !s[key] }));
  };

  const handleApply = async () => {
    if (!onApply) return;
    const updates = {};
    for (const [k, v] of Object.entries(selected)) {
      if (v && suggestions[k]) updates[k] = suggestions[k];
    }
    if (Object.keys(updates).length === 0) return;
    setSubmitting(true);
    try {
      await onApply({ updates, force });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="fixed inset-0 bg-black/70 z-[110] flex items-center justify-center p-6 overflow-y-auto" onClick={onClose}>
      <div className="bg-[#131316] border border-white/[0.08] rounded-2xl max-w-[760px] w-full max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start px-7 py-5 border-b border-white/[0.06] sticky top-0 bg-[#131316] z-10">
          <div>
            <p className="text-[17px] font-bold text-white">Scrape del sitio</p>
            <p className="text-[12.5px] text-gray-300 mt-1">
              {competitor?.url
                ? <>Datos extraídos automáticamente de <span className="text-blue-300">{competitor.url}</span></>
                : 'Datos extraídos del sitio'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-white/[0.04] border border-white/[0.08] w-8 h-8 rounded-full text-white text-[16px] hover:bg-white/[0.1]"
          >
            ✕
          </button>
        </div>

        <div className="px-7 py-6">
          {loading && (
            <div className="text-center py-10">
              <p className="text-[13px] text-gray-300">Descargando el sitio y extrayendo datos...</p>
              <p className="text-[11.5px] text-gray-400 mt-1">Esto puede tardar 5-15 segundos.</p>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl bg-red-500/[0.05] border border-red-500/20 p-4 mb-4">
              <p className="text-[13px] text-red-200 font-semibold">No se pudo scrapear el sitio</p>
              <p className="text-[12px] text-red-200/80 mt-1 leading-relaxed">{error}</p>
              <p className="text-[11.5px] text-gray-300 mt-2 leading-relaxed">
                Algunos sitios bloquean el acceso automático o son 100% SPA sin contenido HTML inicial. Podés cargar los datos a mano editando el competidor.
              </p>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Sugerencias aplicables */}
              <div className="mb-6">
                <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300 mb-3">
                  Sugerencias para aplicar
                </p>
                {Object.keys(suggestions).length === 0 ? (
                  <p className="text-[13px] text-gray-300">
                    No se detectaron sugerencias automáticas. Mirá los datos crudos abajo y completá el competidor a mano.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(suggestions).map(([key, value]) => {
                      const checked = !!selected[key];
                      const currentValue = competitor?.[key];
                      const willOverwrite = !isEmpty(currentValue);
                      return (
                        <label
                          key={key}
                          className={`block rounded-xl border p-3.5 cursor-pointer transition
                            ${checked
                              ? 'bg-blue-500/[0.06] border-blue-500/30'
                              : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.18]'}`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggle(key)}
                              className="mt-1 w-4 h-4 accent-blue-500 cursor-pointer flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <p className="text-[11px] font-bold uppercase tracking-[1.2px] text-gray-300">
                                  {FIELD_LABELS[key] || key}
                                </p>
                                {willOverwrite && !force && (
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                                    Ya tiene valor
                                  </span>
                                )}
                              </div>
                              <p className="text-[13.5px] text-white leading-relaxed">{value}</p>
                              {willOverwrite && (
                                <p className="text-[11px] text-gray-400 mt-1.5">
                                  Valor actual: <span className="text-gray-300">{currentValue}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Datos crudos extraídos */}
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300 mb-2.5">
                  Lo que se vio en el sitio
                </p>
                <div className="space-y-2 text-[12.5px] text-gray-200">
                  {parsed.title && <Row label="Título">{parsed.title}</Row>}
                  {parsed.metaDescription && <Row label="Meta description">{parsed.metaDescription}</Row>}
                  {parsed.ogTitle && parsed.ogTitle !== parsed.title && <Row label="OG title">{parsed.ogTitle}</Row>}
                  {parsed.ogDescription && parsed.ogDescription !== parsed.metaDescription && (
                    <Row label="OG description">{parsed.ogDescription}</Row>
                  )}
                  {parsed.h1?.length > 0 && <Row label="H1">{parsed.h1.join(' · ')}</Row>}
                  {parsed.h2?.length > 0 && <Row label="H2">{parsed.h2.slice(0, 4).join(' · ')}</Row>}
                  {parsed.ctas?.length > 0 && <Row label="Botones / CTAs">{parsed.ctas.slice(0, 6).join(' · ')}</Row>}
                  {parsed.prices?.length > 0 && <Row label="Precios visibles">{parsed.prices.slice(0, 8).join(' · ')}</Row>}
                  {parsed.richParagraphs?.length > 0 && (
                    <Row label="Texto destacado">
                      {parsed.richParagraphs[0]?.slice(0, 240)}{parsed.richParagraphs[0]?.length > 240 ? '…' : ''}
                    </Row>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {!loading && !error && data && Object.keys(suggestions).length > 0 && (
          <div className="px-7 py-4 border-t border-white/[0.06] flex justify-between items-center gap-3 flex-wrap sticky bottom-0 bg-[#131316]">
            <label className="inline-flex items-center gap-2 text-[12px] text-gray-200 cursor-pointer">
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
              Sobreescribir campos que ya tengan valor
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="bg-white/[0.04] border border-white/[0.08] text-gray-200 hover:bg-white/[0.08] hover:text-white px-4 py-2 rounded-lg text-[12.5px] font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={submitting || selectedCount === 0}
                className="bg-blue-500/15 border border-blue-500/35 text-blue-200 hover:bg-blue-500/25 px-4 py-2 rounded-lg text-[12.5px] font-semibold disabled:opacity-50"
              >
                {submitting ? 'Aplicando...' : `Aplicar ${selectedCount} ${selectedCount === 1 ? 'campo' : 'campos'}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: '120px 1fr' }}>
      <span className="text-[10.5px] font-bold uppercase tracking-[1.2px] text-gray-400 pt-0.5">{label}</span>
      <span className="text-[12.5px] text-gray-100 leading-relaxed">{children}</span>
    </div>
  );
}
