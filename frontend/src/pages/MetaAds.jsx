import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import CampaignTable from '../components/meta/CampaignTable';
import CSVImportMeta from '../components/meta/CSVImportMeta';
import MetaDailyTracker from '../components/meta/MetaDailyTracker';
import AIAnalysisPanel from '../components/common/AIAnalysisPanel';
import TopInsightBar from '../components/insights/TopInsightBar';

const TABS = [
  { key: 'campaigns', label: 'Campañas' },
  { key: 'daily', label: 'Daily Tracker' },
  { key: 'import', label: 'Importar CSV' },
];

export default function MetaAds() {
  const { storeId } = useParams();
  const { from, to } = useSelector((s) => s.date);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('campaigns');

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const { data } = await api.get(`/api/stores/${storeId}/meta/campaigns`, { params });
      setCampaigns(data);
    } catch {
      setCampaigns([]);
    }
    setLoading(false);
  }, [storeId, from, to]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return (
    <div className="space-y-5">
      <p className="section-label">Meta Ads</p>

      <TopInsightBar storeId={storeId} />

      {/* Tabs */}
      <div className="flex gap-[2px] bg-gray-100 dark:bg-gray-800 rounded p-0.5 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-[11px] font-semibold rounded transition ${
              tab === t.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'campaigns' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60">
          {loading ? (
            <div className="text-center py-12 text-xs text-gray-500 dark:text-gray-500">Cargando campañas...</div>
          ) : (
            <CampaignTable
              campaigns={campaigns}
              storeId={storeId}
              from={from}
              to={to}
            />
          )}
        </div>
      )}

      {tab === 'daily' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60">
          <MetaDailyTracker storeId={storeId} from={from} to={to} />
        </div>
      )}

      {tab === 'import' && (
        <CSVImportMeta storeId={storeId} onImported={fetchCampaigns} />
      )}

      {/* AI Analysis */}
      <AIAnalysisPanel storeId={storeId} section="meta" from={from} to={to} />
    </div>
  );
}
