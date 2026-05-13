import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import CampaignsTableRich from '../components/meta/CampaignsTableRich';
import CSVImportMeta from '../components/meta/CSVImportMeta';
import { getPeriodLabel } from '../components/common/MasterMetricBoard';
import SourceMetricsRow from '../components/resumen/SourceMetricsRow';
import { META_METRICS, META_DEFAULTS } from '../components/meta/metaMetricsCatalog';
import MetaFunnel from '../components/meta/MetaFunnel';
import MetaSpendRevenueChart from '../components/meta/MetaSpendRevenueChart';
import TopInsightBar from '../components/insights/TopInsightBar';
import SortableLayout from '../components/common/SortableLayout';

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

export default function MetaAds() {
  const { storeId } = useParams();
  const { from, to, preset } = useSelector((s) => s.date);
  const store = useSelector((state) => state.stores.stores.find((item) => item._id === storeId));
  const [campaigns, setCampaigns] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCsvImport, setShowCsvImport] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const [campaignsRes, overviewRes] = await Promise.all([
        api.get(`/api/stores/${storeId}/meta/campaigns`, { params }),
        api.get(`/api/stores/${storeId}/meta/overview`, { params }),
      ]);
      setCampaigns(Array.isArray(campaignsRes.data) ? campaignsRes.data.map(normalizeCampaignRow) : []);
      setOverview(overviewRes.data || null);
    } catch {
      setCampaigns([]);
      setOverview(null);
    }
    setLoading(false);
  }, [storeId, from, to]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <div className="text-center py-12 text-[13px] text-gray-600">Cargando datos de Meta Ads...</div>;

  const sortableItems = [
    {
      id: 'meta-row',
      label: 'KPIs Meta Ads',
      node: (
        <SourceMetricsRow
          sourceKey="meta"
          title="Meta Ads"
          subtitle="Adquisición · gasto, eficiencia y retorno publicitario"
          periodLabel={getPeriodLabel(preset, from, to)}
          availableMetrics={META_METRICS}
          data={overview?.totals || null}
          deltas={null}
          coverage={null}
          storeId={storeId}
          storageKey={`hooks-meta-${storeId}`}
          defaultSelected={META_DEFAULTS}
        />
      ),
    },
    {
      id: 'funnel',
      label: 'Embudo',
      node: <MetaFunnel funnel={overview?.funnel} totals={overview?.totals} excludeKeys={['reach']} />,
    },
    {
      id: 'spend-revenue',
      label: 'Gasto vs facturación',
      node: <MetaSpendRevenueChart data={overview?.daily} />,
    },
    ...(campaigns.length > 0 ? [{
      id: 'campaigns-table',
      label: 'Campañas',
      node: <CampaignsTableRich campaigns={campaigns} />,
    }] : []),
    {
      id: 'csv-import',
      label: 'Importar CSV',
      node: (
        <div className="card p-5">
          <button
            type="button"
            onClick={() => setShowCsvImport((v) => !v)}
            className="w-full flex items-center justify-between gap-3 text-left"
          >
            <div>
              <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Operativo</p>
              <p className="text-white text-[14px] font-semibold mt-1">Importar datos por CSV</p>
              <p className="text-app-secondary text-[12px] mt-0.5">
                Subí un export del Ads Manager si la API queda corta o querés re-procesar un período histórico.
              </p>
            </div>
            <span className={`text-app-muted text-[12px] transition-transform ${showCsvImport ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {showCsvImport && (
            <div className="mt-4 pt-4 border-t border-white/[0.05]">
              <CSVImportMeta storeId={storeId} onImported={fetchAll} />
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <TopInsightBar storeId={storeId} />

      <SortableLayout
        items={sortableItems}
        storageKey={`hooks-metaads-layout-${storeId}`}
      />
    </div>
  );
}
