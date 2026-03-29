export default function MetricValue({
  label,
  value,
  delta,
  prefix = '',
  suffix = '',
  decimals = 0,
  compact = false,
}) {
  const formatted = formatNumber(value, decimals, compact);
  const deltaColor =
    delta > 0
      ? 'text-green-500'
      : delta < 0
        ? 'text-red-500'
        : 'text-gray-400 dark:text-gray-500';
  const deltaArrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '';

  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </span>
      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {prefix}
        {formatted}
        {suffix}
      </span>
      {delta !== undefined && delta !== null && (
        <span className={`text-xs font-medium ${deltaColor}`}>
          {deltaArrow} {Math.abs(delta).toFixed(1)}%
        </span>
      )}
    </div>
  );
}

function formatNumber(num, decimals, compact) {
  if (num == null || isNaN(num)) return '—';
  if (compact && num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (compact && num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
