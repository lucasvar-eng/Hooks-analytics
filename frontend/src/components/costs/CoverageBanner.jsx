/**
 * Banner amber que aparece cuando la cobertura de costos es baja.
 * El profit "oficial" sin COGS/comisiones/fijos es ficticio, hay que avisar fuerte.
 */
export default function CoverageBanner({ overview, onConfigClick }) {
  if (!overview?.summary) return null;

  const summary = overview.summary;
  const totalProducts = summary.totalProducts || 0;
  const withCosts = summary.productsWithCosts || 0;
  const pct = Number(summary.costCoveragePct || 0);

  // Solo mostrar si cobertura < 40%
  if (pct >= 40) return null;

  return (
    <div className="rounded-xl border border-amber-500/25 p-5 flex items-center justify-between gap-4"
         style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,191,36,0.02))' }}>
      <div className="flex items-center gap-4 min-w-0">
        <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2"
                  d="M12 9v3.75m0 3.5h.008v.008H12v-.008zM4.93 19h14.14a1.5 1.5 0 001.3-2.25l-7.07-12.25a1.5 1.5 0 00-2.6 0L3.63 16.75A1.5 1.5 0 004.93 19z" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-amber-300 font-semibold text-[14px]">Tu margen es estimado, no real</p>
          <p className="text-gray-200 text-[12.5px] mt-0.5">
            {withCosts} de {totalProducts.toLocaleString('es-AR')} productos con costo cargado.
            {' '}Sin COGS, comisiones ni fijos, el profit que figura abajo es ficticio.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onConfigClick}
        className="flex-shrink-0 inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-amber-950 font-semibold text-[13px] px-4 py-2 rounded-lg transition"
      >
        Cargar costos
        <span aria-hidden>→</span>
      </button>
    </div>
  );
}
