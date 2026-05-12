/**
 * Embudo de adquisición Meta. Muestra cada paso con:
 *  - Etiqueta y valor absoluto
 *  - Barra de ancho proporcional al valor más alto
 *  - % de conversión vs el paso parent (drop-off entre pasos)
 *  - % share del top (impresiones)
 *
 * Resalta los drops más fuertes para ver dónde se cae el usuario.
 */

function fmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('es-AR');
}
function fmtPct(v, digits = 1) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(digits)}%`;
}
function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}

const STEP_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];

export default function MetaFunnel({ funnel = [], totals = null }) {
  if (!funnel || funnel.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px] text-app-secondary">Sin datos del embudo en el período.</p>
      </div>
    );
  }

  // Filtramos pasos con valor 0 al final si no aportan; pero mantenemos para mostrar drop
  const max = Math.max(...funnel.map((s) => Number(s.value || 0)), 1);

  // Helper: identificar el peor drop-off (peor conversionPct) — para flag de atención
  const worstDrop = funnel.reduce((worst, s) => {
    if (s.conversionPct == null) return worst;
    if (worst == null || s.conversionPct < worst.conversionPct) return s;
    return worst;
  }, null);

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h3 className="text-white text-[15px] font-semibold">Embudo de adquisición</h3>
          <p className="text-app-secondary text-[12px] mt-1">
            Cada paso con su % de conversión vs el anterior — para detectar dónde se cae la gente
          </p>
        </div>
        {totals && (
          <div className="flex items-center gap-5 flex-wrap">
            <div className="text-right">
              <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">CVR final</p>
              <p className="text-white text-[16px] font-bold tabular-nums leading-none mt-1">
                {totals.linkClicks > 0 ? fmtPct((totals.purchases / totals.linkClicks) * 100, 2) : '—'}
              </p>
              <p className="text-app-muted text-[10px] mt-0.5">Click → compra</p>
            </div>
            <div className="text-right">
              <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Spend → revenue</p>
              <p className="text-white text-[16px] font-bold tabular-nums leading-none mt-1">
                {fmtMoney(totals.spend)} → {fmtMoney(totals.purchaseValue)}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {funnel.map((step, i) => {
          const value = Number(step.value || 0);
          const widthPct = max > 0 ? (value / max) * 100 : 0;
          const color = STEP_COLORS[i % STEP_COLORS.length];
          const isWorstDrop = worstDrop && worstDrop.key === step.key && step.conversionPct < 30;

          return (
            <div key={step.key} className="grid grid-cols-[180px,1fr,auto] gap-4 items-center">
              {/* Label + iconito */}
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-bold text-white"
                  style={{ background: color }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-white text-[13px] font-medium leading-tight truncate">{step.label}</p>
                  {step.sharePct != null && (
                    <p className="text-app-muted text-[10px] mt-0.5 tabular-nums">
                      {fmtPct(step.sharePct)} del top
                    </p>
                  )}
                </div>
              </div>

              {/* Barra */}
              <div className="relative h-9 rounded bg-white/[0.03] overflow-hidden">
                <div
                  className="h-full rounded transition-all duration-700"
                  style={{
                    width: `${widthPct}%`,
                    background: `linear-gradient(90deg, ${color}cc, ${color}66)`,
                  }}
                />
                {/* Valor sobre la barra */}
                <div
                  className="absolute inset-y-0 flex items-center px-3 pointer-events-none"
                  style={{ left: widthPct > 25 ? '12px' : `calc(${widthPct}% + 8px)` }}
                >
                  <span className="text-white text-[15px] font-bold tabular-nums" style={{ textShadow: widthPct > 25 ? '0 1px 2px rgba(0,0,0,0.5)' : 'none' }}>
                    {fmtNum(value)}
                  </span>
                </div>
              </div>

              {/* Drop-off vs paso anterior */}
              <div className="text-right min-w-[90px]">
                {step.conversionPct != null ? (
                  <>
                    <p className={`text-[14px] font-bold tabular-nums leading-none ${
                      step.conversionPct >= 50 ? 'text-emerald-300' :
                      step.conversionPct >= 20 ? 'text-amber-300' :
                      'text-red-300'
                    }`}>
                      {fmtPct(step.conversionPct)}
                    </p>
                    <p className="text-app-muted text-[10px] mt-1 leading-tight">
                      vs paso ant.
                    </p>
                    {isWorstDrop && (
                      <p className="text-red-400 text-[10px] mt-0.5 font-semibold">⚠ mayor caída</p>
                    )}
                  </>
                ) : (
                  <p className="text-app-muted text-[11px]">inicio</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Insights al pie */}
      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-5 border-t border-white/[0.05]">
          <div>
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">CTR (click / impresión)</p>
            <p className="text-white text-[14px] font-semibold tabular-nums mt-1">{fmtPct(totals.ctr)}</p>
          </div>
          <div>
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">% Add to cart</p>
            <p className="text-white text-[14px] font-semibold tabular-nums mt-1">
              {totals.linkClicks > 0 ? fmtPct((totals.atc / totals.linkClicks) * 100) : '—'}
            </p>
            <p className="text-app-muted text-[10px] mt-0.5">de los clicks</p>
          </div>
          <div>
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">% checkout</p>
            <p className="text-white text-[14px] font-semibold tabular-nums mt-1">
              {totals.atc > 0 ? fmtPct((totals.checkouts / totals.atc) * 100) : '—'}
            </p>
            <p className="text-app-muted text-[10px] mt-0.5">del ATC</p>
          </div>
          <div>
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">% compra</p>
            <p className="text-white text-[14px] font-semibold tabular-nums mt-1">
              {totals.checkouts > 0 ? fmtPct((totals.purchases / totals.checkouts) * 100) : '—'}
            </p>
            <p className="text-app-muted text-[10px] mt-0.5">del checkout</p>
          </div>
        </div>
      )}
    </div>
  );
}
