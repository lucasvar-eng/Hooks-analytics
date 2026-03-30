import HealthBadge from './HealthBadge';

const KPI_CARDS = [
  { key: 'ordenesPositivas', label: 'Órdenes', prefix: '', suffix: '', decimals: 0 },
  { key: 'revenue', label: 'Revenue', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'adSpend', label: 'Ad Spend', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'profit', label: 'Profit', prefix: '$', suffix: '', decimals: 0, compact: true },
  { key: 'profitMargin', label: 'Margen %', prefix: '', suffix: '%', decimals: 1, targetKey: 'profitMarginMin' },
  { key: 'roas', label: 'ROAS', prefix: '', suffix: 'x', decimals: 2, targetKey: 'roasTarget' },
  { key: 'trueRoas', label: 'True ROAS', prefix: '', suffix: 'x', decimals: 2, targetKey: 'trueRoasTarget' },
  { key: 'cpa', label: 'CPA', prefix: '$', suffix: '', decimals: 0, targetKey: 'cpaMaximo', inverse: true },
];

function formatValue(value, prefix, suffix, decimals, compact) {
  if (value == null || isNaN(value)) return '—';
  let num = Number(value);
  let formatted;
  if (compact && num >= 1000000) formatted = (num / 1000000).toFixed(1) + 'M';
  else if (compact && num >= 1000) formatted = (num / 1000).toFixed(1) + 'K';
  else formatted = num.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${prefix}${formatted}${suffix}`;
}

function TargetBar({ value, target, inverse }) {
  if (!target || !value) return null;
  let pct;
  if (inverse) {
    // For CPA: lower is better, fill decreases as value approaches target
    pct = Math.min(100, Math.max(0, ((target - value) / target) * 100 + 100));
  } else {
    pct = Math.min(100, (value / target) * 100);
  }
  const color = pct >= 90 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  const status = pct >= 90 ? '🟢' : pct >= 60 ? '🟡' : '🔴';

  return (
    <div className="mt-2">
      <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-gray-400 dark:text-gray-500">
          Target: {inverse ? 'máx ' : ''}{formatValue(target, '', inverse ? '' : 'x', 1, false)}
        </span>
        <span className="text-[9px] text-gray-400 dark:text-gray-500">
          {status} {pct >= 100 ? '+' : ''}{Math.round(pct - 100)}%
        </span>
      </div>
    </div>
  );
}

export default function KPITopBar({ current, deltas, objetivos }) {
  const kpis = objetivos?.kpis || {};
  const thresholds = objetivos?.alertThresholds || {};

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-3">
      {KPI_CARDS.map((kpi) => {
        const value = current[kpi.key];
        const delta = deltas[kpi.key];
        const target = kpi.targetKey ? kpis[kpi.targetKey] : null;
        const deltaColor = delta > 0 ? 'text-green-500' : delta < 0 ? 'text-red-500' : 'text-gray-500';
        const deltaArrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '';

        return (
          <div
            key={kpi.key}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-3.5 relative hover:border-gray-300 dark:hover:border-gray-700 transition"
          >
            {/* Health badge */}
            {target && (
              <div className="absolute top-2.5 right-2.5">
                <HealthBadge
                  value={value}
                  target={target}
                  warningPct={thresholds.warningPct}
                  criticalPct={thresholds.criticalPct}
                  inverseLogic={kpi.inverse}
                />
              </div>
            )}

            {/* Label */}
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
              {kpi.label}
            </p>

            {/* Value */}
            <p className="text-[22px] font-bold text-gray-900 dark:text-white leading-none tracking-tight">
              {formatValue(value, kpi.prefix, kpi.suffix, kpi.decimals, kpi.compact)}
            </p>

            {/* Delta */}
            {delta !== undefined && delta !== null && (
              <p className={`text-[11px] font-semibold mt-1 ${deltaColor}`}>
                {deltaArrow} {Math.abs(delta).toFixed(1)}%
              </p>
            )}

            {/* Target bar */}
            {target && <TargetBar value={value} target={target} inverse={kpi.inverse} />}
          </div>
        );
      })}
    </div>
  );
}
