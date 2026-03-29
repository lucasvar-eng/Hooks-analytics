import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';

// ─── helpers ────────────────────────────────────────────────────────────────

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

// ─── sub-components ──────────────────────────────────────────────────────────

function SliderRow({ label, value, min, max, step, unit, onChange, formatValue }) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = formatValue ? formatValue(value) : value;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums min-w-[90px] text-right">
          {display}
        </span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          style={{
            background: `linear-gradient(to right, #4f46e5 ${pct}%, #e5e7eb ${pct}%)`,
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-600">
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
  const deltaColor = delta === 0
    ? 'text-gray-400 dark:text-gray-500'
    : isPositive
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';

  const arrow = delta === 0 ? '→' : delta > 0 ? '↑' : '↓';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>

      <div className="grid grid-cols-2 gap-3">
        {/* Actual */}
        <div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">Actual</p>
          <p className="text-lg font-bold text-gray-700 dark:text-gray-300 tabular-nums leading-tight">
            {formatter(actualVal)}
          </p>
        </div>
        {/* Simulado */}
        <div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">Simulado</p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-tight">
            {formatter(simVal)}
          </p>
        </div>
      </div>

      {/* Delta */}
      <div className={`flex items-center gap-1 text-xs font-semibold ${deltaColor}`}>
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

// ─── main page ───────────────────────────────────────────────────────────────

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

  // slider state — starts at defaults, overwritten once baseline loads
  const [sliders, setSliders] = useState({
    cpm: DEFAULTS.cpm,
    ctr: DEFAULTS.ctr,
    cvr: DEFAULTS.cvr,
    aov: DEFAULTS.aov,
    budget: DEFAULTS.budget,
  });

  // ── fetch metrics once ────────────────────────────────────────────────────
  const loadMetrics = useCallback(async () => {
    if (!storeId || !from || !to) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/api/stores/${storeId}/metrics?from=${from}&to=${to}`);
      const c = data?.current || {};

      // Extract baseline values with fallback to defaults
      const bl = {
        cpm:            parseFloat(c.cpm)            || DEFAULTS.cpm,
        ctr:            parseFloat(c.ctr)            || DEFAULTS.ctr,
        cvr:            parseFloat(c.conversionRate) || DEFAULTS.cvr,
        aov:            parseFloat(c.aov)            || DEFAULTS.aov,
        budget:         parseFloat(c.adSpend)        || DEFAULTS.budget,
        profitMarginPct: parseFloat(c.profitMarginPct) || DEFAULTS.profitMarginPct,
      };

      setBaseline(bl);
      setSliders({
        cpm:    bl.cpm,
        ctr:    bl.ctr,
        cvr:    bl.cvr,
        aov:    bl.aov,
        budget: bl.budget,
      });
    } catch (err) {
      console.error('Simulador: error al cargar métricas', err);
      setError('No se pudieron cargar las métricas base. Usando valores de ejemplo.');
      // Use pure defaults so the simulator is still usable
      const bl = { ...DEFAULTS };
      setBaseline(bl);
      setSliders({
        cpm:    DEFAULTS.cpm,
        ctr:    DEFAULTS.ctr,
        cvr:    DEFAULTS.cvr,
        aov:    DEFAULTS.aov,
        budget: DEFAULTS.budget,
      });
    } finally {
      setLoading(false);
    }
  }, [storeId, from, to]);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  // ── reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    if (!baseline) return;
    setSliders({
      cpm:    baseline.cpm,
      ctr:    baseline.ctr,
      cvr:    baseline.cvr,
      aov:    baseline.aov,
      budget: baseline.budget,
    });
  };

  const set = (key) => (val) => setSliders((s) => ({ ...s, [key]: val }));

  // ── formulas ──────────────────────────────────────────────────────────────
  function calcMetrics(cpm, ctr, cvr, aov, budget, profitMarginPct) {
    const impressions  = budget > 0 && cpm > 0 ? (budget / cpm) * 1000 : 0;
    const clicks       = impressions * (ctr / 100);
    const conversions  = clicks * (cvr / 100);
    const revenue      = conversions * aov;
    const roas         = budget > 0 ? revenue / budget : 0;
    const cpa          = conversions > 0 ? budget / conversions : 0;
    const profit       = revenue * (profitMarginPct / 100) - budget;
    return { impressions, clicks, conversions, revenue, roas, cpa, profit };
  }

  const profitMarginPct = baseline?.profitMarginPct ?? DEFAULTS.profitMarginPct;

  const actualMetrics = useMemo(() => {
    if (!baseline) return null;
    return calcMetrics(
      baseline.cpm, baseline.ctr, baseline.cvr,
      baseline.aov, baseline.budget, profitMarginPct
    );
  }, [baseline, profitMarginPct]);

  const simMetrics = useMemo(() => {
    return calcMetrics(
      sliders.cpm, sliders.ctr, sliders.cvr,
      sliders.aov, sliders.budget, profitMarginPct
    );
  }, [sliders, profitMarginPct]);

  // ── render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 dark:text-gray-400">
        <svg className="animate-spin w-5 h-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Cargando métricas base...
      </div>
    );
  }

  const cards = [
    {
      label: 'Impresiones',
      key: 'impressions',
      formatter: fmtNum,
      higherIsBetter: true,
    },
    {
      label: 'Clicks',
      key: 'clicks',
      formatter: fmtNum,
      higherIsBetter: true,
    },
    {
      label: 'Conversiones',
      key: 'conversions',
      formatter: fmtNum,
      higherIsBetter: true,
    },
    {
      label: 'Revenue',
      key: 'revenue',
      formatter: fmtARS,
      higherIsBetter: true,
    },
    {
      label: 'ROAS',
      key: 'roas',
      formatter: fmtRoas,
      higherIsBetter: true,
    },
    {
      label: 'CPA',
      key: 'cpa',
      formatter: fmtARS,
      higherIsBetter: false, // lower CPA is better
    },
    {
      label: 'Ganancia neta',
      key: 'profit',
      formatter: fmtARS,
      higherIsBetter: true,
    },
  ];

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Simulador What-If
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Ajustá los parámetros y mirá el impacto proyectado en tiempo real
          </p>
        </div>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Resetear valores
        </button>
      </div>

      {/* ── Warning banner ──────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-400">
          {error}
        </div>
      )}

      {/* ── Main grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* ─── LEFT: Sliders ─────────────────────────────────────────────── */}
        <div className="xl:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-6 sticky top-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700">
              <div className="w-1.5 h-5 rounded bg-indigo-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Parámetros de entrada
              </h3>
            </div>

            {/* Baseline info pill */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-md px-3 py-2 text-xs text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Valores iniciales extraídos del período seleccionado
            </div>

            <SliderRow
              label="CPM ($)"
              value={sliders.cpm}
              min={100}
              max={15000}
              step={50}
              onChange={set('cpm')}
              formatValue={(v) => fmtARS(v)}
            />
            <SliderRow
              label="CTR (%)"
              value={sliders.ctr}
              min={0.1}
              max={10}
              step={0.1}
              onChange={set('ctr')}
              formatValue={(v) => fmtPct(v)}
            />
            <SliderRow
              label="CVR — Tasa de conversión (%)"
              value={sliders.cvr}
              min={0.1}
              max={15}
              step={0.1}
              onChange={set('cvr')}
              formatValue={(v) => fmtPct(v)}
            />
            <SliderRow
              label="AOV — Ticket promedio ($)"
              value={sliders.aov}
              min={1000}
              max={200000}
              step={500}
              onChange={set('aov')}
              formatValue={(v) => fmtARS(v)}
            />
            <SliderRow
              label="Presupuesto ($)"
              value={sliders.budget}
              min={1000}
              max={5000000}
              step={5000}
              onChange={set('budget')}
              formatValue={(v) => fmtARS(v)}
            />

            {/* Margin note */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Margen de ganancia fijo:
                <span className="ml-1 font-semibold text-gray-700 dark:text-gray-300">
                  {profitMarginPct.toFixed(1)}%
                </span>
                <span className="ml-1 text-gray-400 dark:text-gray-600">(del baseline)</span>
              </p>
            </div>
          </div>
        </div>

        {/* ─── RIGHT: Results ────────────────────────────────────────────── */}
        <div className="xl:col-span-3 space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SummaryHighlight
              label="Revenue simulado"
              value={fmtARS(simMetrics.revenue)}
              sub={`vs ${fmtARS(actualMetrics?.revenue ?? 0)} actual`}
              positive={simMetrics.revenue >= (actualMetrics?.revenue ?? 0)}
            />
            <SummaryHighlight
              label="ROAS simulado"
              value={fmtRoas(simMetrics.roas)}
              sub={`vs ${fmtRoas(actualMetrics?.roas ?? 0)} actual`}
              positive={simMetrics.roas >= (actualMetrics?.roas ?? 0)}
            />
            <SummaryHighlight
              label="Ganancia neta simulada"
              value={fmtARS(simMetrics.profit)}
              sub={`vs ${fmtARS(actualMetrics?.profit ?? 0)} actual`}
              positive={simMetrics.profit >= (actualMetrics?.profit ?? 0)}
            />
          </div>

          {/* Detail cards heading */}
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-5 rounded bg-gray-300 dark:bg-gray-600" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Comparación detallada
            </h3>
          </div>

          {/* Metric cards grid */}
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

          {/* Formula reference */}
          <details className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
            <summary className="px-4 py-2.5 font-medium select-none">
              Ver fórmulas utilizadas
            </summary>
            <div className="px-4 pb-3 pt-1 space-y-1 font-mono">
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

// ─── Summary highlight card ────────────────────────────────────────────────
function SummaryHighlight({ label, value, sub, positive }) {
  return (
    <div className={`rounded-lg border p-4 ${
      positive
        ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
        : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
    }`}>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${
        positive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
      }`}>
        {value}
      </p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
    </div>
  );
}
