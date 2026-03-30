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

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="section-label">
          Meta Ads — Campañas
        </p>
        <button
          onClick={() => setShowImport(!showImport)}
          className="text-sm px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 transition"
        >
          {showImport ? 'Ocultar importador' : 'Importar CSV'}
        </button>
      </div>

      {showImport && (
        <CSVImportMeta storeId={storeId} onImported={fetchCampaigns} />
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60">
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
    </div>
  );
}
