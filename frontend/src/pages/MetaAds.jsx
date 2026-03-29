import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import CampaignTable from '../components/meta/CampaignTable';
import CSVImportMeta from '../components/meta/CSVImportMeta';
import MetaDailyTracker from '../components/meta/MetaDailyTracker';
import AIAnalysisPanel from '../components/common/AIAnalysisPanel';

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
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Meta Ads
      </h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-750 rounded-lg p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-md transition ${
              tab === t.key
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'campaigns' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Cargando campañas...</div>
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
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
