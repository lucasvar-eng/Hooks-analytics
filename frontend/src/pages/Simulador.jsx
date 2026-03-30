import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';

function fmtARS(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return '$' + Math.round(n).toLocaleString('es-AR');
}
function fmtPct(n, decimals = 1) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toFixed(decimals) + '%';
}
function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Math.round(n).toLocaleString('es-AR');
}
function fmtRoas(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toFixed(2) + 'x';
}

function SliderRow({ label, value, min, max, step, onChange, formatValue }) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = formatValue ? formatValue(value) : value;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-gray-400">{label}</span>
        <span className="text-[13px] font-bold text-blue-400 tabular-nums min-w-[90px] text-right">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, #3b82f6 ${pct}%, rgba(255,255,255,0.08) ${pct}%)` }}
      />
      <div className="flex justify-between text-[10px] text-gray-700">
        <span>{formatValue ? formatValue(min) : min}</span>
        <span>{formatValue ? formatValue(max) : max}</span>
      </div>
    </div>
  );
}

function MetricCard({ label, actual, simulated, formatter, higherIsBetter = true }) {
  const actualVal = actual ?? 0;
  const simVal = simulated ?? 0;
  const delta = simVal - actualVal;
  const pctDelta = actualVal !== 0 ? (delta / Math.abs(actualVal)) * 100 : 0;
  const isPositive = higherIsBetter ? delta >= 0 : delta <= 0;
  const deltaColor = delta === 0 ? 'text-gray-600' : isPositive ? 'text-emerald-400' : 'text-red-400';
  const arrow = delta === 0 ? '→' : delta > 0 ? '↑' : '↓';

  return (
    <div className="card p-3.5 space-y-2">
      <p className="kpi-label">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[9px] text-gray-700 mb-0.5">Actual</p>
          <p className="text-[15px] font-bold text-gray-400 tabular-nums leading-tight">{formatter(actualVal)}</p>
        </div>
        <div>
          <p className="text-[9px] text-gray-700 mb-0.5">Simulado</p>
          <p className="text-[15px] font-bold text-white tabular-nums leading-tight">{formatter(simVal)}</p>
        </div>
      </div>
      <div className={`flex items-center gap-1 text-[11px] font-semibold ${deltaColor}`}>
        <span>{arrow}</span>
        <span>
          {delta === 0
            ? 'Sin cambio'
            : `${isPositive ? '+' : ''}${pctDelta.toFixed(1)}% (${isPositive ? '+' : ''}${formatter(delta)})`}
        </span>
      </div>
    </div>
  );
}

function SummaryHighlight({ label, value, sub, positive }) {
  return (
    <div className={`card p-3.5 border ${positive ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
      <p className="kpi-label">{label}</p>
      <p className={`text-[18px] font-bold tabular-nums mt-1.5 leading-none ${positive ? 'text-emerald-400' : 'text-red-400'}`}>{value}</p>
      <p className="text-[10px] text-gray-600 mt-1">{sub}</p>
    </div>
  );
}

const DEFAULTS = {
  cpm: 1500,
  ctr: 1.0,
  cvr: 2.0,
  aov: 30000,
  budget: 100000,
  profitMarginPct: 30,
};

export default function Simulador() {
  const { storeId } = useParams();
  const { from, to } = useSelector((state) => state.date);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [sliders, setSliders] = useState({
    cpm: DEFAULTS.cpm,
    ctr: DEFAULTS.ctr,
    cvr: DEFAULTS.cvr,
    aov: DEFAULTS.aov,
    budget: DEFAULTS.budget,
  });

  const loadMetrics = useCallback(async () => {
    if (!storeId || !from || !to) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/api/stores/${storeId}/metrics?from=${from}&to=${to}`);
      const c = data?.current || {};
      const bl = {
        cpm: parseFloat(c.cpm) || DEFAULTS.cpm,
        ctr: parseFloat(c.ctr) || DEFAULTS.ctr,
        cvr: parseFloat(c.conversionRate) || DEFAULTS.cvr,
        aov: parseFloat(c.aov) || DEFAULTS.aov,
        budget: parseFloat(c.adSpend) || DEFAULTS.budget,
        profitMarginPct: parseFloat(c.profitMarginPct) || DEFAULTS.profitMarginPct,
      };
      setBaseline(bl);
      setSliders({ cpm: bl.cpm, ctr: bl.ctr, cvr: bl.cvr, aov: bl.aov, budget: bl.budget });
    } catch {
      setError('No se pudieron cargar las métricas base. Usando valores de ejemplo.');
      const bl = { ...DEFAULTS };
      setBaseline(bl);
      setSliders({ cpm: DEFAULTS.cpm, ctr: DEFAULTS.ctr, cvr: DEFAULTS.cvr, aov: DEFAULTS.aov, budget: DEFAULTS.budget });
    } finally {
      setLoading(false);
    }
  }, [storeId, from, to]);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  const handleReset = () => {
    if (!baseline) return;
    setSliders({ cpm: baseline.cpm, ctr: baseline.ctr, cvr: baseline.cvr, aov: baseline.aov, budget: baseline.budget });
  };

  const set = (key) => (val) => setSliders((s) => ({ ...s, [key]: val }));

  function calcMetrics(cpm, ctr, cvr, aov, budget, profitMarginPct) {
    const impressions = budget > 0 && cpm > 0 ? (budget / cpm) * 1000 : 0;
    const clicks = impressions * (ctr / 100);
    const conversions = clicks * (cvr / 100);
    const revenue = conversions * aov;
    const roas = budget > 0 ? revenue / budget : 0;
    const cpa = conversions > 0 ? budget / conversions : 0;
    const profit = revenue * (profitMarginPct / 100) - budget;
    return { impressions, clicks, conversions, revenue, roas, cpa, profit };
  }

  const profitMarginPct = baseline?.profitMarginPct ?? DEFAULTS.profitMarginPct;

  const actualMetrics = useMemo(() => {
    if (!baseline) return null;
    return calcMetrics(baseline.cpm, baseline.ctr, baseline.cvr, baseline.aov, baseline.budget, profitMarginPct);
  }, [baseline, profitMarginPct]);

  const simMetrics = useMemo(() => {
    return calcMetrics(sliders.cpm, sliders.ctr, sliders.cvr, sliders.aov, sliders.budget, profitMarginPct);
  }, [sliders, profitMarginPct]);

  if (loading) {
    return <div className="text-center py-12 text-[13px] text-gray-600">Cargando métricas base...</div>;
  }

  const cards = [
    { label: 'Impresiones', key: 'impressions', formatter: fmtNum, higherIsBetter: true },
    { label: 'Clicks', key: 'clicks', formatter: fmtNum, higherIsBetter: true },
    { label: 'Conversiones', key: 'conversions', formatter: fmtNum, higherIsBetter: true },
    { label: 'Revenue', key: 'revenue', formatter: fmtARS, higherIsBetter: true },
    { label: 'ROAS', key: 'roas', formatter: fmtRoas, higherIsBetter: true },
    { label: 'CPA', key: 'cpa', formatter: fmtARS, higherIsBetter: false },
    { label: 'Ganancia neta', key: 'profit', formatter: fmtARS, higherIsBetter: true },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Simulador What-If</h1>
          <p className="page-subtitle">Ajustá los parámetros y mirá el impacto proyectado en tiempo real.</p>
        </div>
        <button onClick={handleReset} className="btn-secondary flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Resetear
        </button>
      </div>

      {error && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-[12px] text-amber-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Sliders */}
        <div className="xl:col-span-2">
          <div className="card p-5 space-y-5 sticky top-4">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Parámetros de entrada</p>

            <div className="bg-blue-500/[0.07] border border-blue-500/20 rounded-lg px-3 py-2 text-[11px] text-blue-400">
              Valores iniciales extraídos del período seleccionado
            </div>

            <SliderRow label="CPM ($)" value={sliders.cpm} min={100} max={15000} step={50} onChange={set('cpm')} formatValue={fmtARS} />
            <SliderRow label="CTR (%)" value={sliders.ctr} min={0.1} max={10} step={0.1} onChange={set('ctr')} formatValue={fmtPct} />
            <SliderRow label="CVR — Tasa de conversión (%)" value={sliders.cvr} min={0.1} max={15} step={0.1} onChange={set('cvr')} formatValue={fmtPct} />
            <SliderRow label="AOV — Ticket promedio ($)" value={sliders.aov} min={1000} max={200000} step={500} onChange={set('aov')} formatValue={fmtARS} />
            <SliderRow label="Presupuesto ($)" value={sliders.budget} min={1000} max={5000000} step={5000} onChange={set('budget')} formatValue={fmtARS} />

            <div className="pt-2 border-t border-white/[0.06]">
              <p className="text-[12px] text-gray-500">
                Margen de ganancia fijo: <span className="font-semibold text-gray-300">{profitMarginPct.toFixed(1)}%</span>
                <span className="ml-1 text-gray-700">(del baseline)</span>
              </p>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="xl:col-span-3 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SummaryHighlight label="Revenue simulado" value={fmtARS(simMetrics.revenue)} sub={`vs ${fmtARS(actualMetrics?.revenue ?? 0)} actual`} positive={simMetrics.revenue >= (actualMetrics?.revenue ?? 0)} />
            <SummaryHighlight label="ROAS simulado" value={fmtRoas(simMetrics.roas)} sub={`vs ${fmtRoas(actualMetrics?.roas ?? 0)} actual`} positive={simMetrics.roas >= (actualMetrics?.roas ?? 0)} />
            <SummaryHighlight label="Ganancia neta simulada" value={fmtARS(simMetrics.profit)} sub={`vs ${fmtARS(actualMetrics?.profit ?? 0)} actual`} positive={simMetrics.profit >= (actualMetrics?.profit ?? 0)} />
          </div>

          <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Comparación detallada</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cards.map((card) => (
              <MetricCard
                key={card.key}
                label={card.label}
                actual={actualMetrics?.[card.key] ?? 0}
                simulated={simMetrics[card.key]}
                formatter={card.formatter}
                higherIsBetter={card.higherIsBetter}
              />
            ))}
          </div>

          <details className="card text-[12px] text-gray-500 cursor-pointer">
            <summary className="px-4 py-2.5 font-medium select-none">Ver fórmulas utilizadas</summary>
            <div className="px-4 pb-3 pt-1 space-y-1 font-mono text-[11px] text-gray-600">
              <p>Impresiones = (Presupuesto / CPM) × 1000</p>
              <p>Clicks = Impresiones × (CTR / 100)</p>
              <p>Conversiones = Clicks × (CVR / 100)</p>
              <p>Revenue = Conversiones × AOV</p>
              <p>ROAS = Revenue / Presupuesto</p>
              <p>CPA = Presupuesto / Conversiones</p>
              <p>Ganancia = Revenue × Margen% − Presupuesto</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}