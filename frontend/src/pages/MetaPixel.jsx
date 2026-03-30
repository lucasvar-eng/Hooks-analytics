import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import CampaignTable from '../components/meta/CampaignTable';
import CSVImportMeta from '../components/meta/CSVImportMeta';

export default function MetaPixel() {
  const { storeId } = useParams();
  const { from, to } = useSelector((s) => s.date);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Meta Ads</h1>
          <p className="page-subtitle">Campañas y rendimiento de anuncios.</p>
        </div>
        <button onClick={() => setShowImport(!showImport)} className="btn-secondary">
          {showImport ? 'Ocultar importador' : 'Importar CSV'}
        </button>
      </div>

      {showImport && <CSVImportMeta storeId={storeId} onImported={fetchCampaigns} />}

      <div className="card">
        {loading ? (
          <div className="text-center py-12 text-[13px] text-gray-600">Cargando campañas...</div>
        ) : (
          <CampaignTable campaigns={campaigns} storeId={storeId} from={from} to={to} />
        )}
      </div>
    </div>
  );
}