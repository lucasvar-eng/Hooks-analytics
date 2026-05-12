/**
 * Tabla de performance por ángulo de comunicación. Cada fila es un ángulo
 * detectado por Claude (transformación, social proof, etc.) con:
 *   - Cantidad de ads clasificados en él
 *   - Spend / revenue agregado
 *   - ROAS y CTR promedio del grupo
 *   - Recomendación basada en el ROAS
 *
 * Le da al usuario el insight clave: qué línea editorial funciona.
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

function recommendation(roas, ads, spend) {
  if (!spend || spend <= 0) return { label: 'Sin actividad', tone: 'muted' };
  if (ads < 2) return { label: 'Muy poca data', tone: 'muted' };
  if (roas >= 3) return { label: 'Escalar', tone: 'good' };
  if (roas >= 1.5) return { label: 'Mantener', tone: 'warn' };
  if (roas > 0) return { label: 'Optimizar copy', tone: 'warn' };
  return { label: 'Pausar masivo', tone: 'bad' };
}

const TONE_BG = {
  good: 'bg-emerald-500/15 text-emerald-300',
  warn: 'bg-amber-500/15 text-amber-300',
  bad: 'bg-red-500/15 text-red-300',
  muted: 'bg-white/[0.06] text-app-secondary',
};

function roasTone(v) {
  if (v == null || v === 0) return null;
  if (v >= 2.5) return '#6ee7b7';
  if (v >= 1.5) return '#fcd34d';
  return '#fca5a5';
}

export default function AnglePerformanceTable({ data, onAnalyzeAll, analyzeProgress }) {
  const angles = data?.angles || [];
  const totalAnalyzed = data?.totalAnalyzed || 0;

  if (angles.length === 0) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-white text-[15px] font-semibold">Análisis IA por ángulo</h3>
            <p className="text-app-secondary text-[12px] mt-1">
              Claude clasifica cada ad por su propuesta de valor (urgencia, social proof, descuento, etc.)
              para detectar qué línea editorial te funciona mejor.
            </p>
          </div>
          {onAnalyzeAll && (
            <button
              onClick={onAnalyzeAll}
              disabled={analyzeProgress?.running}
              className="bg-purple-500/15 text-purple-200 border border-purple-500/30 px-4 py-2 rounded-md text-[12px] font-semibold hover:bg-purple-500/25 disabled:opacity-50"
            >
              {analyzeProgress?.running ? `Analizando... (${analyzeProgress.done}/${analyzeProgress.total})` : '★ Analizar ads con copy'}
            </button>
          )}
        </div>
        <div className="mt-6 p-8 rounded-lg border border-dashed border-white/[0.08] text-center">
          <p className="text-[28px] mb-2">★</p>
          <p className="text-white text-[14px] font-medium">Todavía no hay anuncios analizados</p>
          <p className="text-app-secondary text-[12px] mt-2 max-w-md mx-auto leading-relaxed">
            Tocá "Analizar ads con copy" para que Claude clasifique cada anuncio por ángulo.
            Después vas a poder ver acá qué línea editorial te rinde más.
          </p>
        </div>
      </div>
    );
  }

  const totalSpend = angles.reduce((s, a) => s + Number(a.spend || 0), 0);
  const totalRevenue = angles.reduce((s, a) => s + Number(a.revenue || 0), 0);

  // Insight clave: comparar el mejor ángulo con el peor (con spend significativo)
  const withSpend = angles.filter((a) => a.spend > 0);
  const sortedByRoas = [...withSpend].sort((a, b) => b.roas - a.roas);
  const winner = sortedByRoas[0];
  const loser = sortedByRoas[sortedByRoas.length - 1];
  const showInsight = winner && loser && winner.angle !== loser.angle && winner.roas > loser.roas * 1.5;

  return (
    <div className="card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-white text-[15px] font-semibold">Performance por ángulo de comunicación</h3>
          <p className="text-app-secondary text-[12px] mt-1">
            {totalAnalyzed} anuncios analizados · {angles.length} ángulos detectados · ordenado por ROAS
          </p>
        </div>
        {onAnalyzeAll && (
          <button
            onClick={onAnalyzeAll}
            disabled={analyzeProgress?.running}
            className="bg-purple-500/15 text-purple-200 border border-purple-500/30 px-3.5 py-2 rounded-md text-[12px] font-semibold hover:bg-purple-500/25 disabled:opacity-50"
          >
            {analyzeProgress?.running ? `Analizando... (${analyzeProgress.done}/${analyzeProgress.total})` : '★ Analizar más ads'}
          </button>
        )}
      </div>

      {/* Insight clave */}
      {showInsight && (
        <div
          className="p-4 rounded-lg border border-emerald-500/25"
          style={{ background: 'linear-gradient(90deg, rgba(16,185,129,0.10), rgba(59,130,246,0.04))' }}
        >
          <p className="inline-flex items-center gap-2 px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-bold uppercase tracking-[0.14em]">
            ★ Insight clave
          </p>
          <p className="text-white text-[14px] leading-relaxed mt-2">
            Tus ads de <mark className="bg-amber-400/20 text-amber-200 px-1 rounded font-semibold">{winner.label}</mark> tienen ROAS promedio{' '}
            <mark className="bg-amber-400/20 text-amber-200 px-1 rounded font-semibold">{fmtMultiple(winner.roas)}</mark>, mientras que los de{' '}
            <mark className="bg-amber-400/20 text-amber-200 px-1 rounded font-semibold">{loser.label}</mark> apenas llegan a{' '}
            <mark className="bg-amber-400/20 text-amber-200 px-1 rounded font-semibold">{fmtMultiple(loser.roas)}</mark>.
            {loser.spend > 0 && ` Reasignar ${fmtMoneyShort(loser.spend)} del peor ángulo al ganador podría facturar ~${fmtMoneyShort(loser.spend * (winner.roas - loser.roas))} más.`}
          </p>
        </div>
      )}

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
              <th className="text-center font-semibold pb-3 px-3">CTR prom.</th>
              <th className="text-center font-semibold pb-3 pl-3">Recomendación</th>
            </tr>
          </thead>
          <tbody>
            {angles.map((a) => {
              const rec = recommendation(a.roas, a.ads, a.spend);
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
                  <td className="py-3.5 px-3 text-center text-app-secondary tabular-nums">{fmtPct(a.ctr)}</td>
                  <td className="py-3.5 pl-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10.5px] font-semibold ${TONE_BG[rec.tone]}`}>
                      {rec.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
