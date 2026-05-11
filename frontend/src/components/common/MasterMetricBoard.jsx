import MetricCompleteness from './MetricCompleteness';

const PRESET_LABELS = {
  today: 'Hoy',
  yesterday: 'Ayer',
  last7: 'Últimos 7 días',
  last30: 'Últimos 30 días',
  thisMonth: 'Este mes',
  lastMonth: 'Mes pasado',
  custom: 'Rango personalizado',
};

export function SourceIcon({ sourceKey }) {
  const key = String(sourceKey || '').toLowerCase();

  if (['meta', 'facebook', 'ads'].includes(key)) {
    return (
      <span className="master-source-icon master-source-icon--meta" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
          <path d="M3.5 12c2.1-2.9 4.2-4.5 6.3-4.5 2.2 0 3.4 1.8 4.2 3 .8-1.2 2-3 4.2-3 2.1 0 4.2 1.6 6.3 4.5-2.1 2.9-4.2 4.5-6.3 4.5-2.2 0-3.4-1.8-4.2-3-.8 1.2-2 3-4.2 3-2.1 0-4.2-1.6-6.3-4.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (['tiendanube', 'store', 'shop', 'tienda'].includes(key)) {
    return (
      <span className="master-source-icon master-source-icon--store" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
          <path d="M7.5 17.5h8a3.5 3.5 0 0 0 .7-6.93 5.2 5.2 0 0 0-10.08.95A3.1 3.1 0 0 0 7.5 17.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (['cash', 'finance', 'p&l', 'pnl'].includes(key)) {
    return (
      <span className="master-source-icon master-source-icon--cash" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
          <path d="M4 8.5h16v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7Zm0 0 2-3h12l2 3M16 12h2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  if (['clientes', 'customers', 'client'].includes(key)) {
    return (
      <span className="master-source-icon master-source-icon--clients" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
          <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 18a4.5 4.5 0 0 1 9 0M13.5 18a4 4 0 0 1 7 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  return (
    <span className="master-source-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
        <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    </span>
  );
}

function deltaTone(delta, invertDelta) {
  if (delta == null || Number.isNaN(Number(delta)) || Number(delta) === 0) {
    return 'text-app-secondary';
  }
  const isPositive = Number(delta) > 0;
  const improves = invertDelta ? !isPositive : isPositive;
  return improves ? 'text-emerald-300' : 'text-red-300';
}

function deltaPrefix(delta, invertDelta) {
  if (delta == null || Number.isNaN(Number(delta)) || Number(delta) === 0) return '';
  const isPositive = Number(delta) > 0;
  const improves = invertDelta ? !isPositive : isPositive;
  return improves ? '↑ ' : '↓ ';
}

export function getPeriodLabel(preset, from, to) {
  if (preset && PRESET_LABELS[preset]) return PRESET_LABELS[preset];
  if (from && to) return `${from} → ${to}`;
  return 'Período actual';
}

export function MasterMetricBoard({
  title,
  subtitle,
  sourceLabel,
  sourceKey,
  periodLabel,
  items,
  rightContent = null,
  columns = 'md:grid-cols-2 xl:grid-cols-4',
  coverage = null,
  storeId = null,
}) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <section className="master-board">
      <div className="master-board__topbar">
        <div className="master-board__meta">
          {sourceLabel && (
            <span className="master-source-pill">
              {sourceKey && <SourceIcon sourceKey={sourceKey} />}
              <span>{sourceLabel}</span>
            </span>
          )}
          {periodLabel && <span className="master-period-pill">{periodLabel}</span>}
        </div>
        {rightContent}
      </div>

      {(title || subtitle) && (
        <div className="master-board__heading">
          {title && <h2 className="master-board__title">{title}</h2>}
          {subtitle && <p className="master-board__subtitle">{subtitle}</p>}
        </div>
      )}

      <div className={`grid grid-cols-2 ${columns} gap-3`}>
        {items.map((item) => (
          <article key={item.label} className="master-metric-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {(item.badge || item.sourceKey) && (
                  <span className="master-metric-card__badge">
                    {item.sourceKey && <SourceIcon sourceKey={item.sourceKey} />}
                    <span>{item.badge || item.sourceKey}</span>
                  </span>
                )}
                <p className="master-metric-card__value mt-1">{item.value}</p>
              </div>
              {item.micro && (
                <span className="master-metric-card__micro">
                  {item.micro}
                </span>
              )}
            </div>

            <div className="mt-3">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="master-metric-card__label">{item.label}</p>
                {item.coverageAware && coverage?.isPreliminary && (
                  <MetricCompleteness coverage={coverage} storeId={storeId} size="sm" />
                )}
              </div>
              {item.subLabel && (
                <p className="master-metric-card__sub">{item.subLabel}</p>
              )}
            </div>

            {(item.delta != null || item.footer) && (
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className={`text-[11px] font-semibold ${deltaTone(item.delta, item.invertDelta)}`}>
                  {item.delta != null && !Number.isNaN(Number(item.delta))
                    ? `${deltaPrefix(item.delta, item.invertDelta)}${Math.abs(Number(item.delta)).toFixed(1)}%`
                    : '—'}
                </span>
                {item.footer && (
                  <span className="text-[11px] text-app-secondary">{item.footer}</span>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export default MasterMetricBoard;
