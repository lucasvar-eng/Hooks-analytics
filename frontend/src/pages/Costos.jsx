import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import { getPeriodLabel } from '../components/common/MasterMetricBoard';
import AIAnalysisPanel from '../components/common/AIAnalysisPanel';
import ClaudeActionBar from '../components/common/ClaudeActionBar';
import TopInsightBar from '../components/insights/TopInsightBar';
import CoverageBanner from '../components/costs/CoverageBanner';
import PnLBreakdown from '../components/costs/PnLBreakdown';
import BreakevenCard from '../components/costs/BreakevenCard';
import CostCoverageChecklist from '../components/costs/CostCoverageChecklist';
import CostsConfigAccordion from '../components/costs/CostsConfigAccordion';

/**
 * Página Costos rediseñada (2026-05-13).
 *
 * Vista GLOBAL de los costos de la operación: P&L del período + breakeven +
 * qué falta cargar a nivel sistema. El detalle por SKU (margen unitario,
 * productos sin costo, dead stock) vive en Productos.
 *
 * Estructura:
 *   1. TopInsightBar
 *   2. CoverageBanner (solo si cobertura < 40%)
 *   3. PnLBreakdown — hero visual con barras proporcionales
 *   4. BreakevenCard + CostCoverageChecklist en grid 2 cols
 *   5. CostsConfigAccordion — Wizard + CSV + Fijos en tabs colapsables
 *   6. ClaudeActionBar + AIAnalysisPanel al final
 */
export default function Costos() {
  const { storeId } = useParams();
  const { from, to, preset } = useSelector((s) => s.date);
  const store = useSelector((state) => state.stores.stores.find((item) => item._id === storeId));
  const coverage = useSelector((s) => s.stores.metrics[storeId]?.costCoverage || null);

  const [pnl, setPnl] = useState(null);
  const [breakeven, setBreakeven] = useState(null);
  const [productOverview, setProductOverview] = useState(null);
  const [storeMetrics, setStoreMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const configRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const [pnlRes, beRes, overviewRes, metricsRes] = await Promise.all([
        api.get(`/api/stores/${storeId}/pnl`, { params }),
        api.get(`/api/stores/${storeId}/breakeven`, { params }),
        api.get(`/api/stores/${storeId}/products/overview`, { params }),
        api.get(`/api/stores/${storeId}/metrics`, { params }),
      ]);
      setPnl(pnlRes.data);
      setBreakeven(beRes.data);
      setProductOverview(overviewRes.data);
      setStoreMetrics(metricsRes.data);
    } catch {
      setPnl(null);
      setBreakeven(null);
      setProductOverview(null);
      setStoreMetrics(null);
    }
    setLoading(false);
  }, [storeId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="text-center py-12 text-gray-300 text-[13px]">Cargando costos...</div>;
  }

  const periodLabel = getPeriodLabel(preset, from, to);
  const adsConnected = store?.integrationStatus?.metaAds?.connected !== false;
  const actuals = storeMetrics?.current ? {
    roas: storeMetrics.current.roas,
    aov: storeMetrics.current.aov,
    cpa: storeMetrics.current.cpa,
  } : null;

  const openConfig = (tab) => configRef.current?.open(tab);

  return (
    <div className="space-y-5">
      <TopInsightBar storeId={storeId} />

      <CoverageBanner
        overview={productOverview}
        onConfigClick={() => openConfig('wizard')}
      />

      <PnLBreakdown
        pnl={pnl}
        coverage={coverage}
        period={{ from, to, label: periodLabel }}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <BreakevenCard breakeven={breakeven} actuals={actuals} />
        <CostCoverageChecklist
          coverage={coverage}
          adsConnected={adsConnected}
          onConfigClick={() => openConfig('wizard')}
        />
      </div>

      <CostsConfigAccordion
        ref={configRef}
        storeId={storeId}
        coverage={coverage}
        adsConnected={adsConnected}
        onChanged={fetchData}
      />

      <div className="card p-5 space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Análisis asistido</p>
          <p className="text-[12.5px] text-gray-200 mt-1">
            Prompts y análisis largos quedan al final para no competir con la lectura del P&L.
          </p>
        </div>
        <ClaudeActionBar storeId={storeId} storeName={store?.nombre} from={from} to={to} mode="costos" />
        <AIAnalysisPanel storeId={storeId} section="costos" from={from} to={to} />
      </div>
    </div>
  );
}
