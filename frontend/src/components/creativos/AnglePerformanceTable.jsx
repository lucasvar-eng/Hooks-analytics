/**
 * Tabla comparativa por ángulo de comunicación. Cada fila es un ángulo
 * (transformación, social proof, etc.) con métricas agregadas del grupo.
 *
 * No emite recomendaciones (Escalar/Pausar/etc.) — eso requiere criterios
 * de tienda + ventana mínima de muestreo + objetivo de campaña. Por ahora
 * sólo muestra los números crudos para que el usuario los lea con su
 * propio criterio. Ver docs/research/analisis-creativos-pendiente.md
 * para la definición del modelo de evaluación.
 */

const ANGLE_EMOJI = {
  'producto-urgencia': '⚡',
  'social-proof': '👥',
  'descuento-general': '🏷️',
  'educativo': '📚',
  'transformacion': '🎯',
  'generico-marca': '💬',
  'otro': '·',
};

const ANGLE_BG = {
  'producto-urgencia': 'rgba(239,68,68,0.15)',
  'social-proof': 'rgba(59,130,246,0.15)',
  'descuento-general': 'rgba(251,191,36,0.15)',
  'educativo': 'rgba(168,85,247,0.15)',
  'transformacion': 'rgba(16,185,129,0.15)',
  'generico-marca': 'rgba(115,115,115,0.15)',
  'otro': 'rgba(115,115,115,0.15)',
};

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}
function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '$0';
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
function fmtPct(v, digits = 1) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(digits)}%`;
}
function fmtMultiple(v, digits = 2) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(digits)}x`;
}

function roasTone(v) {
  if (v == null || v === 0) return null;
  if (v >= 2.5) return '#6ee7b7';
  if (v >= 1.5) return '#fcd34d';
  return '#fca5a5';
}

export default function AnglePerformanceTable({ data }) {
  const angles = data?.angles || [];
  const totalAnalyzed = data?.totalAnalyzed || 0;

  if (angles.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-white text-[15px] font-semibold">Performance por ángulo de comunicación</h3>
        <p className="text-app-secondary text-[12px] mt-1">
          Cuando haya anuncios clasificados por ángulo, los vas a ver agrupados acá con su performance comparativa.
        </p>
        <div className="mt-6 p-8 rounded-lg border border-dashed border-white/[0.08] text-center">
          <p className="text-white text-[14px] font-medium">Todavía no hay anuncios analizados</p>
          <p className="text-app-secondary text-[12px] mt-2 max-w-md mx-auto leading-relaxed">
            El análisis de ángulos se carga manualmente desde la base por ahora. El criterio de
            evaluación se está definiendo por tienda — ver
            <code className="text-blue-300 mx-1 text-[11px]">docs/research/analisis-creativos-pendiente.md</code>.
          </p>
        </div>
      </div>
    );
  }

  const totalSpend = angles.reduce((s, a) => s + Number(a.spend || 0), 0);

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-white text-[15px] font-semibold">Performance por ángulo de comunicación</h3>
        <p className="text-app-secondary text-[12px] mt-1">
          {totalAnalyzed} anuncios clasificados · {angles.length} ángulos detectados · ordenado por ROAS.
          Vista comparativa sin recomendaciones — los criterios de evaluación se ajustan por tienda.
        </p>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.14em] text-app-muted border-b border-white/[0.06]">
              <th className="text-left font-semibold pb-3 pr-3">Ángulo</th>
              <th className="text-center font-semibold pb-3 px-3">Ads</th>
              <th className="text-center font-semibold pb-3 px-3">Spend</th>
              <th className="text-center font-semibold pb-3 px-3">Revenue</th>
              <th className="text-center font-semibold pb-3 px-3">ROAS prom.</th>
              <th className="text-center font-semibold pb-3 pl-3">CTR prom.</th>
            </tr>
          </thead>
          <tbody>
            {angles.map((a) => {
              const tone = roasTone(a.roas);
              const sharePct = totalSpend > 0 ? (a.spend / totalSpend) * 100 : 0;
              return (
                <tr key={a.angle} className="border-b border-white/[0.03] hover:bg-white/[0.015] transition">
                  <td className="py-3.5 pr-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[16px] shrink-0"
                        style={{ background: ANGLE_BG[a.angle] || ANGLE_BG.otro }}
                      >
                        {ANGLE_EMOJI[a.angle] || '·'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-white font-medium leading-tight">{a.label}</p>
                        {a.sampleHook && (
                          <p className="text-app-muted text-[11px] mt-0.5 italic truncate max-w-[280px]" title={a.sampleHook}>
                            "{a.sampleHook}"
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-center text-white tabular-nums">{a.ads}</td>
                  <td className="py-3.5 px-3 text-center">
                    <p className="text-white tabular-nums">{fmtMoneyShort(a.spend)}</p>
                    {sharePct > 0 && <p className="text-app-muted text-[10px] tabular-nums">{sharePct.toFixed(0)}% del total</p>}
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <p className="text-emerald-300 tabular-nums">{fmtMoneyShort(a.revenue)}</p>
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <div className="inline-flex items-center gap-2">
                      <span className="font-bold tabular-nums text-[15px]" style={{ color: tone || '#9ca3af' }}>
                        {fmtMultiple(a.roas)}
                      </span>
                      <div className="w-12 h-1 rounded bg-white/[0.05] overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${Math.min(a.roas * 25, 100)}%`, background: tone || '#525252' }} />
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 pl-3 text-center text-app-secondary tabular-nums">{fmtPct(a.ctr)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
