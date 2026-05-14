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
  if (!objetivos?.kpis) return { color: 'bg-gray-500', dot: 'bg-gray-500', label: 'Sin objetivos' };

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

  if (criticals > 0) return { color: 'text-red-300', dot: 'bg-red-500', label: 'Crítico' };
  if (issues > 0) return { color: 'text-amber-300', dot: 'bg-amber-400', label: 'Atención' };
  return { color: 'text-emerald-300', dot: 'bg-emerald-400', label: 'OK' };
}

function relativeSync(date) {
  if (!date) return null;
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

function normalizeLogoUrl(url) {
  if (!url) return null;
  if (url.startsWith('//')) return `https:${url}`;
  return url;
}

export default function StoreCard({ store, metrics, notes, alertCount = 0 }) {
  const navigate = useNavigate();
  const current = metrics?.current || {};
  const deltas = metrics?.deltas || {};
  const badge = getHealthBadge(current, store.objetivos);
  const platformLabel =
    store.plataforma === 'tiendanube' ? 'Tienda Nube' : store.plataforma === 'shopify' ? 'Shopify' : 'Manual';
  const metaAccounts = Array.isArray(store.metaAdAccounts)
    ? store.metaAdAccounts.filter((item) => item?.id)
    : [];
  const lastSync =
    store.integrationStatus?.tiendanube?.lastSync ||
    store.integrationStatus?.shopify?.lastSync ||
    store.integrationStatus?.metaAds?.lastSync ||
    null;
  const initials = (store.nombre || '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const metricKeys = store.metricasHome?.length ? store.metricasHome : DEFAULT_METRICS;
  const cardMetrics = metricKeys.map((key) => ({ key, ...METRICS_MAP[key] })).filter((m) => m.label);

  const storeDomain = (() => {
    if (!store.storeUrl) return null;
    try {
      return new URL(store.storeUrl).host.replace(/^www\./, '');
    } catch {
      return store.storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
  })();

  const isConnected =
    store.integrationStatus?.tiendanube?.connected ||
    store.integrationStatus?.shopify?.connected;

  return (
    <div
      onClick={() => navigate(`/store/${store._id}/dashboard`)}
      className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.025] to-white/[0.005] p-5 cursor-pointer group transition hover:border-white/[0.14] hover:from-white/[0.04] hover:to-white/[0.01] hover:shadow-2xl hover:shadow-black/30 flex flex-col"
    >
      {/* Alert badge top-right */}
      {alertCount > 0 && (
        <span className="absolute top-4 right-4 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[10px] font-bold text-white bg-red-500 rounded-full shadow-md shadow-red-500/30">
          {alertCount}
        </span>
      )}

      {/* Header: logo + name + meta */}
      <div className="flex items-start gap-3 mb-5">
        {/* Logo prominente */}
        <div className="relative shrink-0">
          {store.logoUrl ? (
            <img
              src={normalizeLogoUrl(store.logoUrl)}
              alt={store.nombre}
              className="w-14 h-14 rounded-xl object-cover border border-white/[0.08] bg-white/[0.02]"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] flex items-center justify-center text-[18px] font-bold text-gray-300">
              {initials}
            </div>
          )}
          {/* Health dot anclado en la esquina del logo */}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-[var(--bg-base,#0a0a0a)] ${badge.dot}`}
            title={badge.label}
          />
        </div>

        {/* Nombre + plataforma + URL */}
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-[15px] text-white group-hover:text-blue-300 transition truncate leading-tight">
            {store.nombre}
          </h3>
          <div className="mt-1 flex items-center gap-2 min-w-0">
            <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 shrink-0">
              {platformLabel}
            </span>
            {storeDomain && (
              <a
                href={store.storeUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] text-gray-600 hover:text-blue-400 truncate transition"
                title="Abrir tienda"
              >
                {storeDomain} ↗
              </a>
            )}
          </div>
          {/* Health label + sync */}
          <div className="mt-1.5 flex items-center gap-3 text-[10px]">
            <span className={`font-medium ${badge.color}`}>{badge.label}</span>
            {lastSync && (
              <span className="text-gray-700">· sync {relativeSync(lastSync)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
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

      {/* Footer: integrations + notes */}
      <div className="mt-auto pt-3 border-t border-white/[0.05] flex flex-wrap items-center gap-1.5">
        {/* Integration chips */}
        {isConnected && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[9px] uppercase tracking-wider text-emerald-300 font-medium">
            <span className="w-1 h-1 rounded-full bg-emerald-400" />
            {store.plataforma === 'shopify' ? 'Shopify' : 'TN'}
          </span>
        )}
        {store.integrationStatus?.metaAds?.connected ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[9px] uppercase tracking-wider text-blue-300 font-medium">
            <span className="w-1 h-1 rounded-full bg-blue-400" />
            Meta {metaAccounts.length > 1 ? `· ${metaAccounts.length}` : ''}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-[9px] uppercase tracking-wider text-gray-500 font-medium">
            Meta off
          </span>
        )}
        {/* Solo se muestra la nota más relevante (devoluciones / debajo de target) en línea */}
        {notes && notes.length > 0 && (() => {
          const focus = notes.find((n) =>
            /devolu|debajo|crit|atenc|target/i.test(n.text || '')
          );
          if (!focus) return null;
          return (
            <span className="text-[10px] text-amber-300/80 ml-auto truncate" title={focus.text}>
              {focus.text}
            </span>
          );
        })()}
      </div>
    </div>
  );
}
