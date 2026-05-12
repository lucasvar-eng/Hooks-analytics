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
import AdCompareModal from '../components/creativos/AdCompareModal';
import AdAnalysisModal from '../components/creativos/AdAnalysisModal';
import AnglePerformanceTable from '../components/creativos/AnglePerformanceTable';
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
  const [compareOpen, setCompareOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisIds, setAnalysisIds] = useState([]);
  const [analyses, setAnalyses] = useState({});
  const [anglesData, setAnglesData] = useState({ angles: [], totalAnalyzed: 0 });
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);

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

  const fetchAngles = useCallback(async () => {
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const { data } = await api.get(`/api/stores/${storeId}/creativos/angles`, { params });
      setAnglesData(data || { angles: [], totalAnalyzed: 0 });
    } catch {
      setAnglesData({ angles: [], totalAnalyzed: 0 });
    }
  }, [storeId, from, to]);

  const fetchAnalyses = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/stores/${storeId}/creativos/analyses`);
      setAnalyses(data || {});
    } catch {
      setAnalyses({});
    }
  }, [storeId]);

  useEffect(() => {
    fetchAds();
    fetchAngles();
    fetchAnalyses();
    setSelectedIds([]);
  }, [fetchAds, fetchAngles, fetchAnalyses]);

  const summary = useMemo(() => buildCreativosData(ads), [ads]);

  const toggleSelect = (metaId) => {
    setSelectedIds((curr) => (curr.includes(metaId) ? curr.filter((id) => id !== metaId) : [...curr, metaId]));
  };

  const handleCompare = (ids) => {
    if (!ids || ids.length < 2) return;
    setCompareOpen(true);
  };

  const compareAds = useMemo(() => {
    if (!compareOpen) return [];
    return selectedIds
      .map((id) => ads.find((a) => a.metaId === id))
      .filter(Boolean)
      .slice(0, 4);
  }, [compareOpen, selectedIds, ads]);

  const runAnalysis = useCallback(async (metaIds) => {
    if (!metaIds || metaIds.length === 0) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const { data } = await api.post(`/api/stores/${storeId}/creativos/analyze`, { metaIds });
      setAnalyses((curr) => ({ ...curr, ...data.analyses }));
      // refresh de la tabla de ángulos para incluir los nuevos
      fetchAngles();
      if (data.stats?.failed > 0) {
        setAnalyzeError(`${data.stats.failed} ads fallaron — revisá créditos de Anthropic en Settings.`);
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Error al llamar a la IA';
      setAnalyzeError(msg);
    } finally {
      setAnalyzing(false);
    }
  }, [storeId, fetchAngles]);

  const handleAnalyze = (ids) => {
    if (!ids || ids.length === 0) return;
    setAnalysisIds(ids);
    setAnalysisOpen(true);
    setAnalyzeError(null);
    // Si alguno no tiene análisis cacheado, dispararlo automáticamente
    const missing = ids.filter((id) => !analyses[id]);
    if (missing.length > 0) runAnalysis(missing);
  };

  const handleAnalyzeAll = () => {
    // Solo analizar ads con copy y no analizados todavía
    const targets = ads
      .filter((a) => (a.creativeBody || a.creativeTitle) && !analyses[a.metaId])
      .slice(0, 30) // batch limit razonable
      .map((a) => a.metaId);
    if (targets.length === 0) {
      setAnalyzeError('No hay ads con copy pendientes de analizar.');
      return;
    }
    runAnalysis(targets);
  };

  const analysisAds = useMemo(() => {
    if (!analysisOpen) return [];
    return analysisIds
      .map((id) => ads.find((a) => a.metaId === id))
      .filter(Boolean);
  }, [analysisOpen, analysisIds, ads]);

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

      <AnglePerformanceTable
        data={anglesData}
        onAnalyzeAll={handleAnalyzeAll}
        analyzeProgress={analyzing ? { running: true, done: 0, total: '?' } : null}
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

      {compareOpen && compareAds.length >= 2 && (
        <AdCompareModal
          ads={compareAds}
          onClose={() => setCompareOpen(false)}
          onAnalyze={(ids) => { setCompareOpen(false); handleAnalyze(ids); }}
        />
      )}

      {analysisOpen && analysisAds.length > 0 && (
        <AdAnalysisModal
          ads={analysisAds}
          analyses={analyses}
          onClose={() => setAnalysisOpen(false)}
          onAnalyze={runAnalysis}
          analyzing={analyzing}
          error={analyzeError}
        />
      )}
    </div>
  );
}
