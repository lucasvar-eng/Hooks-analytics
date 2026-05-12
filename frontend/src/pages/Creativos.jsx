import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import AIAnalysisPanel from '../components/common/AIAnalysisPanel';
import ClaudeActionBar from '../components/common/ClaudeActionBar';
import TopInsightBar from '../components/insights/TopInsightBar';
import { getPeriodLabel } from '../components/common/MasterMetricBoard';
import SourceMetricsRow from '../components/resumen/SourceMetricsRow';
import AdGallery from '../components/creativos/AdGallery';
import {
  CREATIVOS_METRICS,
  CREATIVOS_DEFAULTS,
  buildCreativosData,
} from '../components/creativos/creativosMetricsCatalog';

export default function Creativos() {
  const { storeId } = useParams();
  const { from, to, preset } = useSelector((s) => s.date);
  const store = useSelector((state) => state.stores.stores.find((item) => item._id === storeId));
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const { data } = await api.get(`/api/stores/${storeId}/creativos`, { params });
      setAds(Array.isArray(data) ? data : []);
    } catch {
      setAds([]);
    }
    setLoading(false);
  }, [storeId, from, to]);

  useEffect(() => {
    fetchAds();
    setSelectedIds([]);
  }, [fetchAds]);

  const summary = useMemo(() => buildCreativosData(ads), [ads]);

  const toggleSelect = (metaId) => {
    setSelectedIds((curr) => (curr.includes(metaId) ? curr.filter((id) => id !== metaId) : [...curr, metaId]));
  };

  const handleCompare = (ids) => {
    // Capa 2: navegará al comparador. Por ahora solo console.log
    console.log('Compare ads:', ids);
    alert(`Capa 2 (Comparador) próximamente · ${ids.length} ads seleccionados`);
  };

  const handleAnalyze = (ids) => {
    // Capa 3: análisis IA
    console.log('Analyze ads:', ids);
    alert(`Capa 3 (Análisis IA) próximamente · ${ids.length} ads seleccionados`);
  };

  const handleClickAd = (ad) => {
    // Detalle del ad en drawer/modal (próximamente)
    console.log('Open ad detail:', ad.metaId);
  };

  if (loading) {
    return <div className="text-center py-12 text-[13px] text-gray-600">Cargando anuncios...</div>;
  }

  return (
    <div className="space-y-5">
      <TopInsightBar storeId={storeId} />

      <SourceMetricsRow
        sourceKey="meta"
        title="Anuncios — Meta"
        subtitle="Performance por creativo · análisis a nivel ad"
        periodLabel={getPeriodLabel(preset, from, to)}
        availableMetrics={CREATIVOS_METRICS}
        data={summary}
        deltas={null}
        coverage={null}
        storeId={storeId}
        storageKey={`hooks-creativos-${storeId}`}
        defaultSelected={CREATIVOS_DEFAULTS}
      />

      <AdGallery
        ads={ads}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onClickAd={handleClickAd}
        onClearSelection={() => setSelectedIds([])}
        onCompare={handleCompare}
        onAnalyze={handleAnalyze}
      />

      <div className="card p-5 space-y-4">
        <div>
          <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Análisis asistido</p>
          <p className="text-app-secondary text-[12px] mt-1">
            Prompts y análisis largos quedan al final para no competir con la galería de anuncios.
          </p>
        </div>
        <ClaudeActionBar storeId={storeId} storeName={store?.nombre} from={from} to={to} mode="creativos" />
        <AIAnalysisPanel storeId={storeId} section="creativos" from={from} to={to} />
      </div>
    </div>
  );
}
