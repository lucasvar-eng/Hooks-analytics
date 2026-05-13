import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchStoreMetrics } from '../store/storeSlice';
import api from '../services/api';
import SourceMetricsRow from '../components/resumen/SourceMetricsRow';
import RoasTimelineChart from '../components/resumen/RoasTimelineChart';
import CvrTimelineChart from '../components/resumen/CvrTimelineChart';
import MetaFunnel from '../components/meta/MetaFunnel';
import AttentionPanel from '../components/resumen/AttentionPanel';
import HighlightCard from '../components/resumen/HighlightCard';
import { META_METRICS, TN_METRICS, PNL_METRICS, DEFAULTS } from '../components/resumen/metricsCatalog';
import {
  deriveAlerts,
  buildTopSellersRows,
  buildCampaignsRows,
  buildStockRows,
} from '../components/resumen/deriveResumen';

const PRELIMINAR_BADGE = (
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.06em] bg-amber-500/12 text-amber-300 border border-amber-500/25">
    ● Preliminar
  </span>
);

function HealthPill({ label, value }) {
  const tone = value === 'critical' ? 'bg-red-500/12 text-red-300 border-red-500/20'
    : value === 'warning' ? 'bg-amber-500/12 text-amber-300 border-amber-500/20'
    : value === 'ok' ? 'bg-emerald-500/12 text-emerald-300 border-emerald-500/20'
    : 'bg-white/[0.04] text-app-secondary border-white/[0.06]';
  const dot = value === 'critical' ? 'bg-red-400'
    : value === 'warning' ? 'bg-amber-400'
    : value === 'ok' ? 'bg-emerald-400' : 'bg-gray-500';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${tone}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label} · {value || 'neutral'}
    </span>
  );
}

function periodLabel(preset, from, to) {
  const labels = {
    today: 'Hoy', yesterday: 'Ayer',
    last7: 'Últimos 7 días', last30: 'Últimos 30 días',
    thisMonth: 'Este mes', lastMonth: 'Mes pasado',
  };
  if (preset && labels[preset]) return labels[preset];
  return from && to ? `${from} → ${to}` : 'Rango personalizado';
}

export default function Dashboard() {
  const { storeId } = useParams();
  const dispatch = useDispatch();
  const metrics = useSelector((state) => state.stores.metrics[storeId]);
  const { from, to, preset } = useSelector((state) => state.date);
  const store = useSelector((state) =>
    state.stores.stores.find((s) => s._id === storeId)
  );

  const [productOverview, setProductOverview] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [dailyMetrics, setDailyMetrics] = useState([]);
  const [metaOverview, setMetaOverview] = useState(null);

  useEffect(() => {
    if (storeId && from && to) {
      dispatch(fetchStoreMetrics({ storeId, from, to }));
    }
  }, [dispatch, storeId, from, to]);

  useEffect(() => {
    if (!storeId || !from || !to) return;
    let cancelled = false;
    api.get(`/api/stores/${storeId}/products/overview?from=${from}&to=${to}`)
      .then(({ data }) => { if (!cancelled) setProductOverview(data); })
      .catch(() => {});
    api.get(`/api/stores/${storeId}/meta/campaigns?from=${from}&to=${to}`)
      .then(({ data }) => { if (!cancelled) setCampaigns(Array.isArray(data) ? data : (data?.campaigns || [])); })
      .catch(() => {});
    api.get(`/api/stores/${storeId}/daily-metrics?from=${from}&to=${to}`)
      .then(({ data }) => { if (!cancelled) setDailyMetrics(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setDailyMetrics([]); });
    api.get(`/api/stores/${storeId}/meta/overview?from=${from}&to=${to}`)
      .then(({ data }) => { if (!cancelled) setMetaOverview(data || null); })
      .catch(() => { if (!cancelled) setMetaOverview(null); });
    return () => { cancelled = true; };
  }, [storeId, from, to]);

  const current = metrics?.current || {};
  const deltas = metrics?.deltas || {};
  const coverage = metrics?.costCoverage || null;
  const target = metrics?.target || null;
  const health = metrics?.health || {};
  const periodLbl = periodLabel(preset, from, to);

  const alerts = deriveAlerts({ metrics, productOverview, campaigns, storeId });
  const topSellersRows = buildTopSellersRows(productOverview);
  const campaignRows = buildCampaignsRows(campaigns);
  const stockRows = buildStockRows(productOverview);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="page-title">Resumen</h1>
          <p className="page-subtitle">Status del negocio · {store?.nombre || 'Tienda'} · {periodLbl}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <HealthPill label="Acq" value={health.acquisition} />
          <HealthPill label="Conv" value={health.conversion} />
          <HealthPill label="Profit" value={health.profitability} />
          <HealthPill label="Cash" value={health.liquidity} />
        </div>
      </div>

      <SourceMetricsRow
        sourceKey="meta"
        title="Meta Ads"
        subtitle={`${(store?.metaAdAccounts?.length || 0) > 0 ? `${store.metaAdAccounts.length} ${store.metaAdAccounts.length === 1 ? 'cuenta' : 'cuentas'}` : 'Cuenta principal'} · Sincronizado`}
        periodLabel={periodLbl}
        availableMetrics={META_METRICS}
        data={current}
        deltas={deltas}
        target={target}
        coverage={coverage}
        storeId={storeId}
        storageKey={`hooks-resumen-meta-${storeId}`}
        defaultSelected={DEFAULTS.meta}
        maxSelected={6}
      />

      <SourceMetricsRow
        sourceKey="tn"
        title="Tienda Nube"
        subtitle={store?.tnStoreId ? `Store ${store.tnStoreId}` : 'E-commerce'}
        periodLabel={periodLbl}
        availableMetrics={TN_METRICS}
        data={current}
        deltas={deltas}
        target={target}
        coverage={coverage}
        storeId={storeId}
        storageKey={`hooks-resumen-tn-${storeId}`}
        defaultSelected={DEFAULTS.tn}
        maxSelected={6}
      />

      <RoasTimelineChart data={dailyMetrics} periodLabel={periodLbl} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <MetaFunnel funnel={metaOverview?.funnel} totals={metaOverview?.totals} excludeKeys={['reach']} compact />
        <CvrTimelineChart data={dailyMetrics} periodLabel={periodLbl} />
      </div>

      <SourceMetricsRow
        sourceKey="pnl"
        title="P&L"
        subtitle={coverage?.coveragePct != null ? `Cobertura costos ${coverage.coveragePct}%` : 'Profit & loss calculado'}
        periodLabel={periodLbl}
        availableMetrics={PNL_METRICS}
        data={current}
        deltas={deltas}
        target={target}
        storeId={storeId}
        storageKey={`hooks-resumen-pnl-${storeId}`}
        defaultSelected={DEFAULTS.pnl}
        maxSelected={6}
        rightBadge={coverage?.isPreliminary ? PRELIMINAR_BADGE : null}
      />

      <AttentionPanel alerts={alerts} openFirst={false} storeId={storeId} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <HighlightCard
          title="Top productos del período"
          linkTo={`/store/${storeId}/productos`}
          rows={topSellersRows}
          emptyText="Sin ventas en el período."
        />
        <HighlightCard
          title="Campañas — mejores y peores"
          linkTo={`/store/${storeId}/meta-ads`}
          linkLabel="Meta Ads"
          rows={campaignRows}
          emptyText="Sin campañas activas."
        />
        <HighlightCard
          title="Stock crítico"
          linkTo={`/store/${storeId}/productos`}
          linkLabel="Productos"
          rows={stockRows}
          emptyText="Sin productos con stock crítico."
        />
      </div>

    </div>
  );
}
