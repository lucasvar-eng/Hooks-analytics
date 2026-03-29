/**
 * Semaphore dot showing KPI health vs target.
 * Props:
 *  - value: current metric value
 *  - target: objective value
 *  - warningPct: % deviation for warning (default 10)
 *  - criticalPct: % deviation for critical (default 25)
 *  - inverseLogic: true if higher is worse (e.g., CPA)
 */
export default function HealthBadge({ value, target, warningPct = 10, criticalPct = 25, inverseLogic = false }) {
  if (value == null || target == null || target === 0) return null;

  let pctOff;
  if (inverseLogic) {
    // Higher is worse (CPA): how much above target
    pctOff = ((value - target) / target) * 100;
  } else {
    // Higher is better (ROAS, margin): how much below target
    pctOff = ((target - value) / target) * 100;
  }

  let color, title;
  if (pctOff >= criticalPct) {
    color = 'bg-red-500';
    title = `Crítico: ${pctOff.toFixed(0)}% fuera del objetivo`;
  } else if (pctOff >= warningPct) {
    color = 'bg-yellow-500';
    title = `Atención: ${pctOff.toFixed(0)}% fuera del objetivo`;
  } else if (pctOff > 0) {
    color = 'bg-yellow-400';
    title = `Cerca del objetivo (${pctOff.toFixed(0)}%)`;
  } else {
    color = 'bg-green-500';
    title = 'En objetivo';
  }

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${color} shrink-0`}
      title={title}
    />
  );
}
