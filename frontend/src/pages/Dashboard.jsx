import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchStoreMetrics } from '../store/storeSlice';
import WidgetGrid from '../components/widgets/WidgetGrid';
import PageBlockLayout from '../components/common/PageBlockLayout';
import MasterMetricBoard, { getPeriodLabel } from '../components/common/MasterMetricBoard';
import { createSharedPageBlocks } from '../components/common/pageBlockCatalog';

function fmtMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `$${Math.round(Number(value)).toLocaleString('es-AR')}`;
}

function fmtPct(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(1)}%`;
}

function HealthPill({ label, value }) {
  const tone =
    value === 'critical'
      ? 'bg-red-500/12 text-red-400 border-red-500/20'
      : value === 'warning'
        ? 'bg-amber-500/12 text-amber-400 border-amber-500/20'
        : value === 'ok'
          ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20'
          : 'bg-white/[0.03] text-app-secondary border-white/[0.06]';

  return (
    <div className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${tone}`}>
      {label}: {value || 'neutral'}
    </div>
  );
}

function ExecutiveSnapshot({ metrics, preset, from, to }) {
  if (!metrics?.current) return null;

  const current = metrics.current;
  const previous = metrics.previous || {};
  const health = metrics.health || {};
  const cards = [
    {
      label: 'Ingresos',
      value: fmtMoney(current.revenue),
      delta: current.revenueDelta,
      badge: 'Tienda',
      sourceKey: 'tiendanube',
      subLabel: 'Facturación del período',
    },
    {
      label: 'Órdenes',
      value: Number(current.ordenesPositivas || 0).toLocaleString('es-AR'),
      delta: current.ordersDelta,
      badge: 'Tienda',
      sourceKey: 'tiendanube',
      subLabel: 'Ventas positivas',
    },
    {
      label: 'Ad Spend',
      value: fmtMoney(current.adSpend),
      delta: current.adSpendDelta,
      badge: 'Meta',
      sourceKey: 'meta',
      subLabel: 'Inversión publicitaria',
    },
    {
      label: 'Ganancia',
      value: fmtMoney(current.profit),
      delta: current.profitDelta,
      badge: 'P&L',
      sourceKey: 'pnl',
      subLabel: 'Profit oficial',
    },
    {
      label: 'Margen',
      value: fmtPct(current.profitMargin),
      delta: current.profitMarginDelta,
      badge: 'P&L',
      sourceKey: 'pnl',
      subLabel: 'Sobre ingresos',
    },
    {
      label: 'True ROAS',
      value: `${(current.trueRoas || 0).toFixed(2)}x`,
      delta: current.trueRoasDelta,
      badge: 'Meta',
      sourceKey: 'meta',
      subLabel: 'Retorno total',
    },
    {
      label: 'AOV',
      value: fmtMoney(current.aov),
      delta: previous.aov ? ((current.aov - previous.aov) / Math.abs(previous.aov || 1)) * 100 : null,
      badge: 'Tienda',
      sourceKey: 'tiendanube',
      subLabel: 'Ticket promedio',
    },
    {
      label: 'CVR',
      value: fmtPct(current.conversionRate),
      delta: previous.conversionRate ? ((current.conversionRate - previous.conversionRate) / Math.abs(previous.conversionRate || 1)) * 100 : null,
      badge: 'Funnel',
      sourceKey: 'clientes',
      subLabel: 'Conversión de tienda',
    },
  ];

  return (
    <MasterMetricBoard
      title="Panorama ejecutivo"
      subtitle="La lectura inicial del negocio debería entenderse en segundos: primero KPIs, después detalle."
      sourceLabel="Hooks Analytics"
      sourceKey="tiendanube"
      periodLabel={getPeriodLabel(preset, from, to)}
      items={cards}
      rightContent={(
        <div className="flex flex-wrap gap-2">
          <HealthPill label="Acq." value={health.acquisition} />
          <HealthPill label="Conv." value={health.conversion} />
          <HealthPill label="Profit" value={health.profitability} />
          <HealthPill label="Cash" value={health.liquidity} />
        </div>
      )}
    />
  );
}

export default function Dashboard() {
  const { storeId } = useParams();
  const dispatch = useDispatch();
  const metrics = useSelector((state) => state.stores.metrics[storeId]);
  const { from, to, preset } = useSelector((state) => state.date);
  const store = useSelector((state) =>
    state.stores.stores.find((s) => s._id === storeId)
  );
  const sharedBlocks = createSharedPageBlocks('dashboard', {
    storeId,
    storeName: store?.nombre,
    from,
    to,
    mode: 'dashboard',
    section: 'dashboard',
    analysisDescription: 'IA, prompts y análisis más largos quedan abajo para no invadir la lectura ejecutiva.',
  });
  const current = metrics?.current || {};
  const previous = metrics?.previous || {};
  const blockContext = useMemo(() => ({
    kpiOptions: [
      { id: 'revenue', label: 'Ingresos', value: current.revenue, format: 'money', sourceKey: 'tiendanube', badge: 'Tienda', description: 'Facturación del período' },
      { id: 'orders', label: 'Órdenes', value: current.ordenesPositivas, format: 'number', sourceKey: 'tiendanube', badge: 'Tienda', description: 'Ventas positivas' },
      { id: 'adspend', label: 'Ad Spend', value: current.adSpend, format: 'money', sourceKey: 'meta', badge: 'Meta', description: 'Inversión publicitaria' },
      { id: 'profit', label: 'Ganancia', value: current.profit, format: 'money', sourceKey: 'pnl', badge: 'P&L', description: 'Profit oficial' },
      { id: 'margin', label: 'Margen', value: current.profitMargin, format: 'percent', sourceKey: 'pnl', badge: 'P&L', description: 'Sobre ingresos' },
      { id: 'true-roas', label: 'True ROAS', value: current.trueRoas, format: 'ratio', sourceKey: 'meta', badge: 'Meta', description: 'Retorno total' },
      { id: 'aov', label: 'AOV', value: current.aov, format: 'money', sourceKey: 'tiendanube', badge: 'Tienda', description: 'Ticket promedio' },
      { id: 'cvr', label: 'CVR', value: current.conversionRate, format: 'percent', sourceKey: 'clientes', badge: 'Funnel', description: 'Conversión de tienda' },
    ],
    comparisonOptions: [
      { id: 'revenue-periods', label: 'Ingresos vs período anterior', currentLabel: 'Actual', currentValue: current.revenue, previousLabel: 'Anterior', previousValue: previous.revenue, format: 'money', description: 'Comparativa de ingresos entre período actual y anterior.' },
      { id: 'orders-periods', label: 'Órdenes vs período anterior', currentLabel: 'Actual', currentValue: current.ordenesPositivas, previousLabel: 'Anterior', previousValue: previous.ordenesPositivas, format: 'number', description: 'Comparativa de ventas positivas.' },
      { id: 'profit-periods', label: 'Ganancia vs período anterior', currentLabel: 'Actual', currentValue: current.profit, previousLabel: 'Anterior', previousValue: previous.profit, format: 'money', description: 'Comparativa de profit oficial.' },
      { id: 'roas-periods', label: 'True ROAS vs período anterior', currentLabel: 'Actual', currentValue: current.trueRoas, previousLabel: 'Anterior', previousValue: previous.trueRoas, format: 'ratio', description: 'Comparativa de retorno total.' },
    ],
    tableOptions: [
      {
        id: 'executive-table',
        label: 'Tabla de KPIs ejecutivos',
        description: 'Resumen simple de los principales KPI del período.',
        columns: [
          { key: 'metric', label: 'Métrica' },
          { key: 'value', label: 'Valor' },
          { key: 'prev', label: 'Anterior' },
        ],
        rows: [
          { id: 'r1', metric: 'Ingresos', value: fmtMoney(current.revenue), prev: fmtMoney(previous.revenue) },
          { id: 'r2', metric: 'Órdenes', value: Number(current.ordenesPositivas || 0).toLocaleString('es-AR'), prev: Number(previous.ordenesPositivas || 0).toLocaleString('es-AR') },
          { id: 'r3', metric: 'Ad Spend', value: fmtMoney(current.adSpend), prev: fmtMoney(previous.adSpend) },
          { id: 'r4', metric: 'Ganancia', value: fmtMoney(current.profit), prev: fmtMoney(previous.profit) },
          { id: 'r5', metric: 'True ROAS', value: `${Number(current.trueRoas || 0).toFixed(2)}x`, prev: `${Number(previous.trueRoas || 0).toFixed(2)}x` },
        ],
      },
    ],
    chartOptions: [],
    donutOptions: [
      {
        id: 'business-mix',
        label: 'Mix ejecutivo',
        description: 'Relación simple entre ingresos, inversión y ganancia.',
        segments: [
          { label: 'Ingresos', value: current.revenue, format: 'money', color: '#60a5fa' },
          { label: 'Ad Spend', value: current.adSpend, format: 'money', color: '#f472b6' },
          { label: 'Ganancia', value: current.profit, format: 'money', color: '#34d399' },
        ],
      },
    ],
    heatmapOptions: [],
  }), [current, previous]);

  useEffect(() => {
    if (storeId && from && to) {
      dispatch(fetchStoreMetrics({ storeId, from, to }));
    }
  }, [dispatch, storeId, from, to]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Resumen</h1>
        <p className="page-subtitle">Lectura rápida del negocio con los KPIs que más importan primero.</p>
      </div>

      <PageBlockLayout
        storeId={storeId}
        pageKey="dashboardFixed"
        storeLayouts={store?.pageLayouts}
        initiallyEmpty
        blockContext={blockContext}
        presetTemplates={[
          {
            id: 'executive',
            label: 'Resumen ejecutivo',
            helper: 'KPIs + insight + análisis',
            blockIds: ['executive-strip', 'dashboard-insight', 'dashboard-analysis'],
          },
          {
            id: 'performance',
            label: 'Performance + detalle',
            helper: 'KPIs + grilla de widgets',
            blockIds: ['executive-strip', 'detail-grid'],
          },
        ]}
        blocks={[
          {
            id: 'executive-strip',
            label: 'KPIs principales',
            category: 'Analítica',
            content: <ExecutiveSnapshot metrics={metrics} preset={preset} from={from} to={to} />,
          },
          {
            id: 'detail-grid',
            label: 'Detalle del período',
            category: 'Detalle',
            content: (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Detalle del período</p>
                    <p className="text-app-secondary text-[12px] mt-1">Bajá a tendencias, comparaciones y tablas solo después de mirar los KPI principales.</p>
                  </div>
                </div>
                <WidgetGrid
                  storeId={storeId}
                  pageId="dashboard"
                  metrics={metrics}
                  objetivos={store?.objetivos}
                  from={from}
                  to={to}
                />
              </div>
            ),
          },
          ...sharedBlocks,
        ]}
      />
    </div>
  );
}
