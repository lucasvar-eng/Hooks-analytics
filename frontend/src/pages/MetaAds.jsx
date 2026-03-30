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

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Meta Ads</h1>
        <p className="page-subtitle">Campañas, sets de anuncios y performance de creativos.</p>
      </div>

      <TopInsightBar storeId={storeId} />

      {/* Tabs */}
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

      {/* Tab content */}
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

      <AIAnalysisPanel storeId={storeId} section="meta" from={from} to={to} />
    </div>
  );
}