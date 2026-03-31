import { useNavigate } from 'react-router-dom';
import MetricValue from '../common/MetricValue';

const METRICS_MAP = {
  ordenesPositivas: { label: 'Ventas', prefix: '', suffix: '', decimals: 0 },
  revenue: { label: 'Ingresos', prefix: '$', suffix: '', decimals: 0, compact: true },
  netRevenue: { label: 'Ingresos netos', prefix: '$', suffix: '', decimals: 0, compact: true },
  profit: { label: 'Ganancia', prefix: '$', suffix: '', decimals: 0, compact: true },
  profitMargin: { label: 'Margen', prefix: '', suffix: '%', decimals: 1 },
  adSpend: { label: 'Ad Spend', prefix: '$', suffix: '', decimals: 0, compact: true },
  roas: { label: 'ROAS', prefix: '', suffix: 'x', decimals: 2 },
  trueRoas: { label: 'True ROAS', prefix: '', suffix: 'x', decimals: 2 },
  cpa: { label: 'CPA', prefix: '$', suffix: '', decimals: 0 },
  trueCpa: { label: 'True CPA', prefix: '$', suffix: '', decimals: 0 },
  ncPct: { label: 'NC %', prefix: '', suffix: '%', decimals: 1 },
  aov: { label: 'AOV', prefix: '$', suffix: '', decimals: 0, compact: true },
  conversionRate: { label: 'CVR', prefix: '', suffix: '%', decimals: 2 },
  ctr: { label: 'CTR', prefix: '', suffix: '%', decimals: 2 },
  cpm: { label: 'CPM', prefix: '$', suffix: '', decimals: 0 },
  devoluciones: { label: 'Devol.', prefix: '', suffix: '', decimals: 0 },
};

const DEFAULT_METRICS = ['ordenesPositivas', 'revenue', 'trueRoas', 'profit', 'conversionRate'];

function getHealthBadge(current, objetivos) {
  if (!objetivos?.kpis) return { color: 'bg-gray-600', label: 'Sin objetivos' };

  const kpis = objetivos.kpis;
  const warn = objetivos.alertThresholds?.warningPct || 10;
  let issues = 0;
  let criticals = 0;

  if (kpis.roasTarget && current.roas) {
    const pct = ((kpis.roasTarget - current.roas) / kpis.roasTarget) * 100;
    if (pct > warn * 2) criticals++;
    else if (pct > 0) issues++;
  }
  if (kpis.cpaMaximo && current.cpa) {
    if (current.cpa > kpis.cpaMaximo * 1.5) criticals++;
    else if (current.cpa > kpis.cpaMaximo) issues++;
  }
  if (kpis.profitMarginMin && current.profitMargin) {
    if (current.profitMargin < kpis.profitMarginMin * 0.5) criticals++;
    else if (current.profitMargin < kpis.profitMarginMin) issues++;
  }

  if (criticals > 0) return { color: 'bg-red-500', label: 'Crítico' };
  if (issues > 0) return { color: 'bg-amber-500', label: 'Atención' };
  return { color: 'bg-emerald-500', label: 'OK' };
}

export default function StoreCard({ store, metrics, notes, alertCount = 0 }) {
  const navigate = useNavigate();
  const current = metrics?.current || {};
  const deltas = metrics?.deltas || {};
  const badge = getHealthBadge(current, store.objetivos);
  const platformLabel = store.plataforma === 'tiendanube' ? 'Tienda Nube' : store.plataforma === 'shopify' ? 'Shopify' : 'Manual';
  const metaAccounts = Array.isArray(store.metaAdAccounts) ? store.metaAdAccounts.filter((item) => item?.id) : [];
  const lastSync =
    store.integrationStatus?.tiendanube?.lastSync ||
    store.integrationStatus?.shopify?.lastSync ||
    null;
  const initials = (store.nombre || '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const metricKeys = store.metricasHome?.length ? store.metricasHome : DEFAULT_METRICS;
  const cardMetrics = metricKeys.map(key => ({ key, ...METRICS_MAP[key] })).filter(m => m.label);

  return (
    <div
      onClick={() => navigate(`/store/${store._id}/dashboard`)}
      className="card-hover p-4 cursor-pointer group flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          {store.logoUrl ? (
            <img
              src={store.logoUrl}
              alt={store.nombre}
              className="w-7 h-7 rounded-lg object-cover border border-white/[0.08] shrink-0"
            />
          ) : (
            <div className="w-7 h-7 rounded-lg border border-white/[0.08] bg-white/[0.04] shrink-0 flex items-center justify-center text-[10px] font-semibold text-gray-300">
              {initials}
            </div>
          )}
          <span className={`w-2 h-2 rounded-full shrink-0 ${badge.color}`} title={badge.label} />
          <div className="min-w-0">
            <h3 className="font-bold text-[13px] text-white group-hover:text-blue-400 transition truncate">
              {store.nombre}
            </h3>
            <div className="flex items-center gap-2 mt-0.5 min-w-0">
              <p className="text-[9px] uppercase tracking-[0.22em] text-gray-600 truncate">
                {platformLabel}
              </p>
              {store.integrationStatus?.metaAds?.connected && metaAccounts.length > 1 ? (
                <span className="text-[9px] text-blue-300 truncate">
                  Meta {metaAccounts.length} cuentas
                </span>
              ) : null}
              {lastSync ? (
                <span className="text-[9px] text-gray-700 truncate">
                  Sync {new Date(lastSync).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                </span>
              ) : null}
            </div>
          </div>
          {alertCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold text-white bg-red-500 rounded-full shrink-0">
              {alertCount}
            </span>
          )}
        </div>
        <svg className="w-3.5 h-3.5 text-gray-700 group-hover:text-blue-400 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {cardMetrics.map((m) => (
          <MetricValue
            key={m.key}
            label={m.label}
            value={current[m.key]}
            delta={deltas[m.key]}
            prefix={m.prefix}
            suffix={m.suffix}
            decimals={m.decimals}
            compact={m.compact}
          />
        ))}
      </div>

      {/* Notes */}
      {notes && notes.length > 0 && (
        <div className="mt-auto pt-3 border-t border-white/[0.06]">
          {notes.slice(0, 2).map((note, i) => (
            <p key={i} className="text-[10px] text-gray-600 truncate">
              {note.icon && <span className="mr-1">{note.icon}</span>}
              {note.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
