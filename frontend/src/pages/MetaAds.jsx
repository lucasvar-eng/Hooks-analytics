import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import CampaignTable from '../components/meta/CampaignTable';
import CSVImportMeta from '../components/meta/CSVImportMeta';
import MetaDailyTracker from '../components/meta/MetaDailyTracker';
import PageBlockLayout from '../components/common/PageBlockLayout';
import MasterMetricBoard, { getPeriodLabel } from '../components/common/MasterMetricBoard';
import { createSharedPageBlocks } from '../components/common/pageBlockCatalog';

const TABS = [
  { key: 'campaigns', label: 'Campañas' },
  { key: 'daily', label: 'Daily Tracker' },
  { key: 'import', label: 'Importar CSV' },
];

function fmtMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `$${Math.round(Number(value)).toLocaleString('es-AR')}`;
}

function normalizeCampaignRow(item) {
  const metrics = item?.metrics || {};
  return {
    ...item,
    nombre:
      item?.nombre ||
      item?.creativeName ||
      (item?.metaId ? `Campaña ${item.metaId}` : 'Campaña sin nombre'),
    status:
      item?.status ||
      (Number(metrics.spend || 0) > 0 ? 'ACTIVE' : 'SIN_ESTADO'),
    objective: item?.objective || '',
    metrics: {
      ...metrics,
      revenue: Number(metrics.revenue || metrics.purchaseValue || 0),
    },
  };
}

function getCampaignTotals(campaigns = []) {
  return campaigns.reduce((acc, campaign) => {
    const metrics = campaign.metrics || {};
    acc.spend += Number(metrics.spend || 0);
    acc.revenue += Number(metrics.revenue || metrics.purchaseValue || 0);
    acc.purchases += Number(metrics.purchases || 0);
    acc.clicks += Number(metrics.clicks || 0);
    acc.impressions += Number(metrics.impressions || 0);
    acc.reach += Number(metrics.reach || 0);
    return acc;
  }, { spend: 0, revenue: 0, purchases: 0, clicks: 0, impressions: 0, reach: 0 });
}

function groupDailyMetricsByMonth(rows = [], valueKey) {
  const buckets = new Map();
  rows.forEach((item) => {
    const key = String(item.date || item._id || '').slice(0, 7);
    buckets.set(key, (buckets.get(key) || 0) + Number(item[valueKey] || 0));
  });
  return Array.from(buckets.entries()).map(([label, value]) => ({ label, value }));
}

function MetaExecutiveStrip({ campaigns, accounts, lastSync, preset, from, to }) {
  if (!campaigns?.length) return null;

  const totals = getCampaignTotals(campaigns);

  const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const cpa = totals.purchases > 0 ? totals.spend / totals.purchases : 0;
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const active = campaigns.filter((item) => item.status === 'ACTIVE').length;
  const withSpend = campaigns.filter((item) => Number(item.metrics?.spend || 0) > 0).length;
  const paused = campaigns.filter((item) => item.status === 'PAUSED').length;
  const syncText = lastSync
    ? new Date(lastSync).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : 'Sin sync reciente';

  const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;

  const cards = [
    { label: 'Importe gastado', value: fmtMoney(totals.spend), badge: 'Meta', sourceKey: 'meta', subLabel: 'Este mes' },
    { label: 'CPM', value: fmtMoney(cpm), badge: 'Meta', sourceKey: 'cash', subLabel: 'Costo por mil' },
    { label: 'Alcance', value: totals.reach.toLocaleString('es-AR'), badge: 'Meta', sourceKey: 'meta', subLabel: 'Reach total' },
    { label: 'CTR', value: `${ctr.toFixed(2)}%`, badge: 'Meta', sourceKey: 'clientes', subLabel: 'Click through rate' },
    { label: 'Compras', value: totals.purchases.toLocaleString('es-AR'), badge: 'Meta', sourceKey: 'meta', subLabel: 'Compras atribuidas' },
    { label: 'CPA', value: fmtMoney(cpa), badge: 'Meta', sourceKey: 'meta', subLabel: 'Costo por compra', invertDelta: true },
    { label: 'Valor de conversión', value: fmtMoney(totals.revenue), badge: 'Meta', sourceKey: 'meta', subLabel: 'Revenue ads' },
    { label: 'ROAS', value: `${roas.toFixed(2)}x`, badge: 'Meta', sourceKey: 'meta', subLabel: `${withSpend} con gasto · ${paused} pausadas` },
  ];

  return (
    <MasterMetricBoard
      title="Adquisición en una vista"
      subtitle="Primero gasto, eficiencia y retorno. Debajo queda el análisis de campañas y anuncios."
      sourceLabel="Meta Ads"
      sourceKey="meta"
      periodLabel={getPeriodLabel(preset, from, to)}
      items={cards}
      rightContent={(
        <div className="flex flex-wrap items-center gap-2">
          <span className="master-period-pill">{accounts.length || 0} cuenta{accounts.length === 1 ? '' : 's'}</span>
          <span className="master-period-pill">Sync: {syncText}</span>
        </div>
      )}
    />
  );
}

export default function MetaAds() {
  const { storeId } = useParams();
  const { from, to, preset } = useSelector((s) => s.date);
  const storeFromList = useSelector((state) => state.stores.stores.find((item) => item._id === storeId));
  const [campaigns, setCampaigns] = useState([]);
  const [dailyMetrics, setDailyMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('campaigns');
  const [storeData, setStoreData] = useState(storeFromList || null);
  const sharedBlocks = createSharedPageBlocks('meta', {
    storeId,
    storeName: storeData?.nombre || storeFromList?.nombre,
    from,
    to,
    mode: 'meta',
    section: 'meta',
    analysisDescription: 'Prompts y análisis largos quedan abajo para no competir con los KPI de adquisición.',
  });

  useEffect(() => {
    if (storeFromList) {
      setStoreData((current) => current?._id === storeFromList._id ? { ...current, ...storeFromList } : storeFromList);
    }
  }, [storeFromList]);

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/stores/${storeId}`)
      .then(({ data }) => {
        if (!cancelled) setStoreData(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const { data } = await api.get(`/api/stores/${storeId}/meta/campaigns`, { params });
      setCampaigns(Array.isArray(data) ? data.map(normalizeCampaignRow) : []);
    } catch {
      setCampaigns([]);
    }
    setLoading(false);
  }, [storeId, from, to]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  useEffect(() => {
    let cancelled = false;
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;

    api.get(`/api/stores/${storeId}/daily-metrics`, { params })
      .then(({ data }) => {
        if (!cancelled) setDailyMetrics(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setDailyMetrics([]);
      });

    return () => {
      cancelled = true;
    };
  }, [from, storeId, to]);

  const connectedMetaAccounts = Array.isArray(storeData?.metaAdAccounts)
    ? storeData.metaAdAccounts.filter((item) => item?.id)
    : [];
  const blockContext = useMemo(() => {
    const totals = getCampaignTotals(campaigns);
    const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
    const cpa = totals.purchases > 0 ? totals.spend / totals.purchases : 0;
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;

    return {
      kpiOptions: [
        { id: 'meta-spend', label: 'Importe gastado', value: totals.spend, format: 'money', sourceKey: 'meta', badge: 'Meta', description: 'Inversión publicitaria' },
        { id: 'meta-cpm', label: 'CPM', value: cpm, format: 'money', sourceKey: 'cash', badge: 'Meta', description: 'Costo por mil' },
        { id: 'meta-reach', label: 'Alcance', value: totals.reach, format: 'number', sourceKey: 'meta', badge: 'Meta', description: 'Reach total' },
        { id: 'meta-ctr', label: 'CTR', value: ctr, format: 'percent', sourceKey: 'clientes', badge: 'Meta', description: 'Click through rate' },
        { id: 'meta-purchases', label: 'Compras', value: totals.purchases, format: 'number', sourceKey: 'meta', badge: 'Meta', description: 'Compras atribuidas' },
        { id: 'meta-revenue', label: 'Valor de conversión', value: totals.revenue, format: 'money', sourceKey: 'meta', badge: 'Meta', description: 'Revenue ads' },
        { id: 'meta-roas', label: 'ROAS', value: roas, format: 'ratio', sourceKey: 'meta', badge: 'Meta', description: 'Retorno publicitario' },
        { id: 'meta-cpa', label: 'CPA', value: cpa, format: 'money', sourceKey: 'meta', badge: 'Meta', description: 'Costo por compra' },
      ],
      comparisonOptions: [
        { id: 'spend-vs-revenue', label: 'Spend vs revenue ads', currentLabel: 'Spend', currentValue: totals.spend, previousLabel: 'Revenue ads', previousValue: totals.revenue, format: 'money', description: 'Comparativa entre inversión y valor atribuido.' },
        { id: 'active-vs-paused', label: 'Activas vs pausadas', currentLabel: 'Activas', currentValue: campaigns.filter((item) => item.status === 'ACTIVE').length, previousLabel: 'Pausadas', previousValue: campaigns.filter((item) => item.status === 'PAUSED').length, format: 'number', description: 'Estado actual de campañas.' },
      ],
      tableOptions: [
        {
          id: 'campaign-results',
          label: 'Resultados por campaña',
          description: 'Top campañas del período por inversión.',
          columns: [
            { key: 'name', label: 'Campaña' },
            { key: 'spend', label: 'Gasto' },
            { key: 'purchases', label: 'Compras' },
            { key: 'roas', label: 'ROAS' },
          ],
          rows: campaigns.slice(0, 10).map((campaign) => ({
            id: campaign.metaId,
            name: campaign.nombre,
            spend: fmtMoney(campaign.metrics?.spend),
            purchases: Number(campaign.metrics?.purchases || 0).toLocaleString('es-AR'),
            roas: `${Number(campaign.metrics?.roas || 0).toFixed(2)}x`,
          })),
        },
      ],
      chartOptions: [
        {
          id: 'sales-per-day',
          label: 'Ventas x día',
          description: 'Valor de conversión diario.',
          format: 'money',
          series: dailyMetrics.map((item) => ({
            label: String(item.date || item._id || '').slice(5, 10),
            value: Number(item.metaPurchaseValue || 0),
          })),
        },
        {
          id: 'spend-per-day',
          label: 'Gasto x día',
          description: 'Inversión publicitaria diaria.',
          format: 'money',
          series: dailyMetrics.map((item) => ({
            label: String(item.date || item._id || '').slice(5, 10),
            value: Number(item.adSpend || 0),
          })),
        },
        {
          id: 'sales-per-month',
          label: 'Ventas x mes',
          description: 'Valor de conversión agregado por mes.',
          format: 'money',
          series: groupDailyMetricsByMonth(dailyMetrics, 'metaPurchaseValue'),
        },
        {
          id: 'spend-per-month',
          label: 'Gasto x mes',
          description: 'Inversión publicitaria agregada por mes.',
          format: 'money',
          series: groupDailyMetricsByMonth(dailyMetrics, 'adSpend'),
        },
      ],
      donutOptions: [
        {
          id: 'campaign-status-split',
          label: 'Campañas activas vs pausadas',
          description: 'Composición actual del estado de campañas.',
          segments: [
            { label: 'Activas', value: campaigns.filter((item) => item.status === 'ACTIVE').length, format: 'number', color: '#34d399' },
            { label: 'Pausadas', value: campaigns.filter((item) => item.status === 'PAUSED').length, format: 'number', color: '#f59e0b' },
          ],
        },
      ],
      heatmapOptions: [
        {
          id: 'daily-spend-heatmap',
          label: 'Heatmap gasto por día',
          description: 'Mapa simple de inversión diaria.',
          format: 'money',
          cells: dailyMetrics.map((item) => ({
            label: String(item.date || item._id || '').slice(5, 10),
            value: Number(item.adSpend || 0),
          })),
        },
        {
          id: 'daily-sales-heatmap',
          label: 'Heatmap ventas por día',
          description: 'Mapa simple de compras diarias.',
          format: 'number',
          cells: dailyMetrics.map((item) => ({
            label: String(item.date || item._id || '').slice(5, 10),
            value: Number(item.metaPurchases || 0),
          })),
        },
      ],
    };
  }, [campaigns, dailyMetrics]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Meta Ads</h1>
        <p className="page-subtitle">Primero la lectura rápida de adquisición; después campañas, tablas y análisis más profundos.</p>
      </div>

      <PageBlockLayout
        storeId={storeId}
        pageKey="metaFixed"
        storeLayouts={storeData?.pageLayouts}
        initiallyEmpty
        blockContext={blockContext}
        presetTemplates={[
          {
            id: 'meta-performance',
            label: 'Meta performance',
            helper: 'Resumen + conexión + campañas',
            blockIds: ['meta-summary', 'meta-connection', 'meta-content'],
          },
          {
            id: 'meta-audit',
            label: 'Meta + análisis',
            helper: 'Resumen + insight + análisis',
            blockIds: ['meta-summary', 'meta-insight', 'meta-analysis'],
          },
        ]}
        blocks={[
          {
            id: 'meta-summary',
            label: 'Resumen Meta',
            category: 'Analítica',
            content: (
              <MetaExecutiveStrip
                campaigns={campaigns}
                accounts={connectedMetaAccounts.length
                  ? connectedMetaAccounts
                  : storeData?.metaAdAccountId ? [{ id: storeData.metaAdAccountId }] : []}
                lastSync={storeData?.integrationStatus?.metaAds?.lastSync}
                preset={preset}
                from={from}
                to={to}
              />
            ),
          },
          {
            id: 'meta-connection',
            label: 'Conexión Meta',
            category: 'Conexiones',
            content: storeData?.integrationStatus?.metaAds?.connected ? (
              <div className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Conexión Meta</p>
                    <h2 className="text-white text-lg font-semibold mt-1">
                      {connectedMetaAccounts.length > 1 ? `${connectedMetaAccounts.length} cuentas activas en esta tienda` : '1 cuenta activa en esta tienda'}
                    </h2>
                  </div>
                  <div className="text-[12px] text-app-secondary">
                    Principal: <span className="text-white font-mono">{storeData?.metaAdAccountId || '—'}</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(connectedMetaAccounts.length
                    ? connectedMetaAccounts
                    : storeData?.metaAdAccountId
                      ? [{ id: storeData.metaAdAccountId, name: storeData.metaAdAccountId, isPrimary: true }]
                      : []
                  ).map((account) => (
                    <div key={account.id} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
                      <span className="text-[11px] text-white">{account.name || account.id}</span>
                      {account.isPrimary && <span className="text-[10px] text-emerald-300 ml-2">Principal</span>}
                    </div>
                  ))}
                </div>
              </div>
            ) : null,
          },
          {
            id: 'meta-content',
            label: 'Campañas y tablas',
            category: 'Detalle',
            content: (
              <div className="space-y-5">
                <div className="flex gap-2 border-b border-white/[0.06] pb-0">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition ${
                        tab === t.key
                          ? 'border-blue-500 text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {tab === 'campaigns' && (
                  <div className="card">
                    {loading ? (
                      <div className="text-center py-12 text-[13px] text-gray-600">Cargando campañas...</div>
                    ) : (
                      <CampaignTable campaigns={campaigns} storeId={storeId} from={from} to={to} />
                    )}
                  </div>
                )}

                {tab === 'daily' && (
                  <div className="card">
                    <MetaDailyTracker storeId={storeId} from={from} to={to} />
                  </div>
                )}

                {tab === 'import' && (
                  <CSVImportMeta storeId={storeId} onImported={fetchCampaigns} />
                )}
              </div>
            ),
          },
          ...sharedBlocks,
        ]}
      />
    </div>
  );
}
