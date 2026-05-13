/**
 * Punto de equilibrio: 3 mínimos (ROAS, CPA, Ticket) y comparación contra los valores reales
 * del período. Hace la lectura "estoy bien o no" inmediata sin que el usuario tenga que pensar.
 *
 * Props:
 *   breakeven: { roasBreakeven, cpaBreakeven, aovMinimo, aov }
 *   actuals: { roas, aov, cpa }  // del aggregateRange del período
 */

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}

function fmtRoas(v) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(2).replace('.', ',')}×`;
}

function compareTone(actual, min, invert = false) {
  if (actual == null || min == null || isNaN(actual) || isNaN(min)) return 'neutral';
  if (min === 0) return 'neutral';
  const ratio = actual / min;
  if (invert) {
    // CPA: real <= min es bueno
    if (ratio <= 1) return 'good';
    if (ratio <= 1.1) return 'warn';
    return 'bad';
  }
  // ROAS / AOV: real >= min es bueno
  if (ratio >= 1) return 'good';
  if (ratio >= 0.9) return 'warn';
  return 'bad';
}

const TONE_CLASS = {
  good: 'text-emerald-400',
  warn: 'text-amber-400',
  bad: 'text-red-400',
  neutral: 'text-gray-300',
};

export default function BreakevenCard({ breakeven, actuals }) {
  if (!breakeven) return null;

  const roasMin = breakeven.roasBreakeven;
  const cpaMax = breakeven.cpaBreakeven;
  const aovMin = breakeven.aovMinimo;
  const aov = breakeven.aov || actuals?.aov || 0;
  const roas = actuals?.roas;
  const cpa = actuals?.cpa;

  const roasTone = compareTone(roas, roasMin);
  const cpaTone = compareTone(cpa, cpaMax, true);
  const aovTone = compareTone(aov, aovMin);

  return (
    <div className="card p-6">
      <div className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Punto de equilibrio</p>
        <p className="text-[12.5px] text-gray-200 mt-1">Mínimos para no perder plata con la inversión publicitaria</p>
      </div>

      <MinRow
        label="ROAS mínimo"
        sub="Por cada $1 invertido en ads"
        value={fmtRoas(roasMin)}
      />
      <MinRow
        label="CPA máximo"
        sub="Costo por compra tolerable"
        value={fmtMoney(cpaMax)}
      />
      <MinRow
        label="Ticket mínimo"
        sub="AOV para que valga la pena"
        value={fmtMoney(aovMin)}
        isLast
      />

      <div className="mt-4 pt-4 border-t border-dashed border-white/[0.06]">
        <p className="text-[12px] text-gray-300 mb-2">Hoy estás en</p>
        <ActualRow label="ROAS" min={fmtRoas(roasMin)} actual={fmtRoas(roas)} tone={roasTone} />
        {cpa > 0 && (
          <ActualRow label="CPA" min={fmtMoney(cpaMax)} actual={fmtMoney(cpa)} tone={cpaTone} />
        )}
        <ActualRow label="Ticket" min={fmtMoney(aovMin)} actual={fmtMoney(aov)} tone={aovTone} />
      </div>
    </div>
  );
}

function MinRow({ label, sub, value, isLast }) {
  return (
    <div className={`flex items-baseline justify-between py-3 ${isLast ? '' : 'border-b border-white/[0.04]'}`}>
      <div>
        <div className="text-[12.5px] text-gray-100">{label}</div>
        <div className="text-[11px] text-gray-300 mt-0.5">{sub}</div>
      </div>
      <div className="text-[15px] font-bold text-white tabular-nums">{value}</div>
    </div>
  );
}

function ActualRow({ label, min, actual, tone }) {
  return (
    <div className="flex items-baseline justify-between py-1 text-[12px]">
      <span className="text-gray-200">{label}</span>
      <span className="tabular-nums">
        <span className="text-gray-300">mín {min}</span>
        <span className="text-gray-400 mx-1.5">·</span>
        <span className={`font-semibold ${TONE_CLASS[tone]}`}>real {actual}</span>
      </span>
    </div>
  );
}
