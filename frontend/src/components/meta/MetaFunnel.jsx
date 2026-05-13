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

export default function MetaFunnel({
  funnel = [],
  totals = null,
  excludeKeys = [],
  compact = false,
}) {
  if (!funnel || funnel.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px] text-app-secondary">Sin datos del embudo en el período.</p>
      </div>
    );
  }

  // Filtrar pasos excluidos y RECALCULAR conversionPct/sharePct
  // relativo al nuevo primer paso ("top").
  const filtered = funnel.filter((s) => !excludeKeys.includes(s.key));
  if (filtered.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px] text-app-secondary">Sin datos del embudo en el período.</p>
      </div>
    );
  }

  const newTop = filtered[0];
  const newTopValue = Number(newTop?.value || 0);
  const steps = filtered.map((s, idx) => {
    if (idx === 0) {
      return { ...s, conversionPct: null, sharePct: null };
    }
    const prev = filtered[idx - 1];
    const value = Number(s.value || 0);
    const prevValue = Number(prev.value || 0);
    return {
      ...s,
      conversionPct: prevValue > 0 ? (value / prevValue) * 100 : null,
      sharePct: newTopValue > 0 ? (value / newTopValue) * 100 : null,
    };
  });

  const top = steps[0];
  const topValue = Number(top?.value || 0);

  // Encontrar el peor drop-off para flag
  const worstDrop = steps.reduce((worst, s) => {
    if (s.conversionPct == null) return worst;
    if (worst == null || s.conversionPct < worst.conversionPct) return s;
    return worst;
  }, null);

  // Conversión global "primer paso → compra" usando el label dinámico del top
  const purchases = Number(totals?.purchases || 0);
  const globalConvPct = topValue > 0 ? (purchases / topValue) * 100 : null;
  const lastStep = steps[steps.length - 1];

  return (
    <div className={`card ${compact ? 'p-4' : 'p-5'}`}>
      <div className={`flex items-start justify-between gap-4 ${compact ? 'mb-4' : 'mb-6'} flex-wrap`}>
        <div>
          <h3 className={`text-white font-semibold ${compact ? 'text-[14px]' : 'text-[15px]'}`}>Embudo de adquisición</h3>
          {!compact && (
            <p className="text-app-secondary text-[12px] mt-1">
              Cada paso con su % de conversión vs el anterior — para detectar dónde se cae la gente
            </p>
          )}
        </div>
        {totals && !compact && (
          <div className="text-right">
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Conversión global</p>
            <p className="text-white text-[18px] font-bold tabular-nums leading-none mt-1">
              {globalConvPct != null ? fmtPct(globalConvPct, 2) : '—'}
            </p>
            <p className="text-app-muted text-[10px] mt-0.5">
              {top?.label || 'Top'} → {lastStep?.label?.toLowerCase() || 'compra'}
            </p>
          </div>
        )}
        {totals && compact && globalConvPct != null && (
          <div className="text-right">
            <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">{top?.label || 'Top'} → compra</p>
            <p className="text-white text-[16px] font-bold tabular-nums leading-none mt-1">{fmtPct(globalConvPct, 2)}</p>
          </div>
        )}
      </div>

      {/* Embudo: contenedor flex column con cada paso centrado */}
      <div className="relative">
        {steps.map((step, i) => {
          const value = Number(step.value || 0);
          // Width relativo al primer paso (Alcance = 100%, va decreciendo)
          const widthPct = topValue > 0 ? Math.max((value / topValue) * 100, 3) : 0;
          // Width minimo para legibilidad cuando los valores son muy chicos
          const displayWidth = Math.max(widthPct, 8);
          const color = STEP_COLORS[i % STEP_COLORS.length];
          const tone = toneForConversion(step.conversionPct);
          const isWorstDrop = worstDrop && worstDrop.key === step.key && step.conversionPct < 30;

          // Para el conector (siguiente paso)
          const next = steps[i + 1];
          const nextValue = next ? Number(next.value || 0) : null;
          const nextWidthPct = nextValue != null && topValue > 0
            ? Math.max((nextValue / topValue) * 100, 3)
            : null;
          const nextDisplayWidth = nextWidthPct != null ? Math.max(nextWidthPct, 8) : null;

          return (
            <div key={step.key}>
              {/* Fila del paso */}
              <div className={`grid items-center ${compact ? 'gap-3 min-h-[54px]' : 'gap-4 min-h-[68px]'}`}
                   style={{ gridTemplateColumns: compact ? '140px 1fr 100px' : '200px 1fr 140px' }}>
                {/* Label izquierda */}
                <div className="flex items-center gap-2.5">
                  <span
                    className={`inline-flex items-center justify-center rounded-md font-bold text-white shrink-0 ${compact ? 'w-6 h-6 text-[11px]' : 'w-7 h-7 text-[12px]'}`}
                    style={{ background: color }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-white font-medium leading-tight ${compact ? 'text-[12.5px]' : 'text-[13.5px]'}`}>{step.label}</p>
                    {step.sharePct != null && !compact && (
                      <p className="text-app-muted text-[10px] mt-0.5 tabular-nums">
                        {fmtPct(step.sharePct)} de {top?.label?.toLowerCase() || 'inicio'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Barra del embudo CENTRADA — esto da la forma cónica */}
                <div className={`flex items-center justify-center relative ${compact ? 'h-9' : 'h-12'}`}>
                  <div
                    className="h-full rounded-md flex items-center justify-center transition-all duration-700 relative"
                    style={{
                      width: `${displayWidth}%`,
                      background: `linear-gradient(180deg, ${color}cc, ${color}66)`,
                      boxShadow: `0 4px 16px ${color}33, inset 0 1px 0 ${color}80`,
                    }}
                  >
                    <span
                      className={`text-white font-bold tabular-nums whitespace-nowrap px-2 ${compact ? 'text-[12px]' : 'text-[14px]'}`}
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
                      <p className={`font-bold tabular-nums leading-none ${TONE_TEXT[tone]} ${compact ? 'text-[14px]' : 'text-[16px]'}`}>
                        {fmtPct(step.conversionPct)}
                      </p>
                      {!compact && <p className="text-app-muted text-[10px] mt-1 leading-tight">vs paso anterior</p>}
                      {isWorstDrop && !compact && (
                        <p className="text-red-400 text-[10px] mt-1 font-semibold">⚠ mayor caída</p>
                      )}
                    </>
                  ) : (
                    <p className="text-app-muted text-[11px]">inicio</p>
                  )}
                </div>
              </div>

              {/* Conector trapezoidal entre el paso actual y el próximo */}
              {next && nextDisplayWidth != null && (
                <div className="grid gap-3"
                     style={{ gridTemplateColumns: compact ? '140px 1fr 100px' : '200px 1fr 140px' }}>
                  <div />
                  <div className={`flex items-center justify-center ${compact ? 'h-3' : 'h-5'}`}>
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

      {/* El bloque de métricas al pie (CTR/%ATC/%Checkout/%Compra) se eliminó
          porque duplicaba la columna derecha de cada paso del embudo. */}
    </div>
  );
}
