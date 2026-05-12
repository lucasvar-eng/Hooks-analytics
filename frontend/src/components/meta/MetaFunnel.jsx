/**
 * Embudo de adquisición con forma de embudo real: barras centradas
 * horizontalmente que decrecen, conector visual entre pasos para mostrar
 * el drop-off como un cono.
 *
 * Sólo pasos con acción del usuario (impresiones queda fuera —
 * exposición, no decisión).
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

const STEP_COLORS = ['#3b82f6', '#6366f1', '#a855f7', '#d946ef', '#ec4899'];

function toneForConversion(pct) {
  if (pct == null) return 'neutral';
  if (pct >= 50) return 'good';
  if (pct >= 20) return 'warn';
  return 'bad';
}

const TONE_TEXT = {
  good: 'text-emerald-300',
  warn: 'text-amber-300',
  bad: 'text-red-300',
  neutral: 'text-app-muted',
};

export default function MetaFunnel({ funnel = [], totals = null }) {
  if (!funnel || funnel.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px] text-app-secondary">Sin datos del embudo en el período.</p>
      </div>
    );
  }

  const top = funnel[0];
  const topValue = Number(top?.value || 0);

  // Encontrar el peor drop-off para flag
  const worstDrop = funnel.reduce((worst, s) => {
    if (s.conversionPct == null) return worst;
    if (worst == null || s.conversionPct < worst.conversionPct) return s;
    return worst;
  }, null);

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h3 className="text-white text-[15px] font-semibold">Embudo de adquisición</h3>
          <p className="text-app-secondary text-[12px] mt-1">
            Cada paso con su % de conversión vs el anterior — para detectar dónde se cae la gente
          </p>
        </div>
        {totals && (
          <div className="flex items-center gap-6 flex-wrap">
            <div className="text-right">
              <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Conversión global</p>
              <p className="text-white text-[18px] font-bold tabular-nums leading-none mt-1">
                {topValue > 0 ? fmtPct((totals.purchases / topValue) * 100, 2) : '—'}
              </p>
              <p className="text-app-muted text-[10px] mt-0.5">Alcance → compra</p>
            </div>
            <div className="text-right">
              <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Spend → revenue</p>
              <p className="text-white text-[16px] font-bold tabular-nums leading-none mt-1">
                {fmtMoney(totals.spend)} <span className="text-app-muted mx-1">→</span> <span className="text-emerald-300">{fmtMoney(totals.purchaseValue)}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Embudo: contenedor flex column con cada paso centrado */}
      <div className="relative">
        {funnel.map((step, i) => {
          const value = Number(step.value || 0);
          // Width relativo al primer paso (Alcance = 100%, va decreciendo)
          const widthPct = topValue > 0 ? Math.max((value / topValue) * 100, 3) : 0;
          // Width minimo para legibilidad cuando los valores son muy chicos
          const displayWidth = Math.max(widthPct, 8);
          const color = STEP_COLORS[i % STEP_COLORS.length];
          const tone = toneForConversion(step.conversionPct);
          const isWorstDrop = worstDrop && worstDrop.key === step.key && step.conversionPct < 30;

          // Para el conector (siguiente paso)
          const next = funnel[i + 1];
          const nextValue = next ? Number(next.value || 0) : null;
          const nextWidthPct = nextValue != null && topValue > 0
            ? Math.max((nextValue / topValue) * 100, 3)
            : null;
          const nextDisplayWidth = nextWidthPct != null ? Math.max(nextWidthPct, 8) : null;

          return (
            <div key={step.key}>
              {/* Fila del paso */}
              <div className="grid grid-cols-[200px,1fr,140px] gap-4 items-center min-h-[68px]">
                {/* Label izquierda */}
                <div className="flex items-center gap-2.5">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[12px] font-bold text-white shrink-0"
                    style={{ background: color }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-white text-[13.5px] font-medium leading-tight">{step.label}</p>
                    {step.sharePct != null && (
                      <p className="text-app-muted text-[10px] mt-0.5 tabular-nums">
                        {fmtPct(step.sharePct)} del top
                      </p>
                    )}
                  </div>
                </div>

                {/* Barra del embudo CENTRADA — esto da la forma cónica */}
                <div className="flex items-center justify-center h-12 relative">
                  <div
                    className="h-full rounded-md flex items-center justify-center transition-all duration-700 relative"
                    style={{
                      width: `${displayWidth}%`,
                      background: `linear-gradient(180deg, ${color}cc, ${color}66)`,
                      boxShadow: `0 4px 16px ${color}33, inset 0 1px 0 ${color}80`,
                    }}
                  >
                    <span
                      className="text-white text-[14px] font-bold tabular-nums whitespace-nowrap px-2"
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                    >
                      {fmtNum(value)}
                    </span>
                  </div>
                </div>

                {/* Drop-off derecha */}
                <div className="text-right">
                  {step.conversionPct != null ? (
                    <>
                      <p className={`text-[16px] font-bold tabular-nums leading-none ${TONE_TEXT[tone]}`}>
                        {fmtPct(step.conversionPct)}
                      </p>
                      <p className="text-app-muted text-[10px] mt-1 leading-tight">vs paso anterior</p>
                      {isWorstDrop && (
                        <p className="text-red-400 text-[10px] mt-1 font-semibold">⚠ mayor caída</p>
                      )}
                    </>
                  ) : (
                    <p className="text-app-muted text-[11px]">punto de partida</p>
                  )}
                </div>
              </div>

              {/* Conector trapezoidal entre el paso actual y el próximo */}
              {next && nextDisplayWidth != null && (
                <div className="grid grid-cols-[200px,1fr,140px] gap-4">
                  <div />
                  <div className="flex items-center justify-center h-5">
                    <svg
                      viewBox="0 0 100 20"
                      preserveAspectRatio="none"
                      className="w-full h-full overflow-visible"
                      style={{ display: 'block' }}
                    >
                      <polygon
                        points={`${50 - displayWidth / 2},0 ${50 + displayWidth / 2},0 ${50 + nextDisplayWidth / 2},20 ${50 - nextDisplayWidth / 2},20`}
                        fill={`${color}22`}
                        stroke={`${color}55`}
                        strokeWidth="0.4"
                      />
                    </svg>
                  </div>
                  <div />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Métricas de funnel adicionales al pie */}
      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/[0.05]">
          <div>
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">CTR</p>
            <p className="text-white text-[14px] font-semibold tabular-nums mt-1">{fmtPct(totals.ctr)}</p>
            <p className="text-app-muted text-[10px] mt-0.5">click / impresión</p>
          </div>
          <div>
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">% Add to cart</p>
            <p className="text-white text-[14px] font-semibold tabular-nums mt-1">
              {totals.linkClicks > 0 ? fmtPct((totals.atc / totals.linkClicks) * 100) : '—'}
            </p>
            <p className="text-app-muted text-[10px] mt-0.5">de los clicks</p>
          </div>
          <div>
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">% Checkout</p>
            <p className="text-white text-[14px] font-semibold tabular-nums mt-1">
              {totals.atc > 0 ? fmtPct((totals.checkouts / totals.atc) * 100) : '—'}
            </p>
            <p className="text-app-muted text-[10px] mt-0.5">del ATC</p>
          </div>
          <div>
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">% Compra</p>
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
