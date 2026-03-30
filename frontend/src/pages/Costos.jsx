import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import AIAnalysisPanel from '../components/common/AIAnalysisPanel';

function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function pct(v) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(1)}%`;
}

function PnLSection({ pnl }) {
  if (!pnl) return null;

  return (
    <div className="card p-5">
      <p className="kpi-label mb-4">P&L del período</p>

      <div className="space-y-0.5">
        <div className="flex justify-between py-2.5 border-b border-white/[0.06]">
          <span className="text-[13px] font-semibold text-white">Revenue</span>
          <span className="text-[13px] font-bold text-white">{fmt(pnl.revenue)}</span>
        </div>

        {pnl.lines?.map((line) => (
          <div key={line.label} className="flex justify-between py-2">
            <span className="text-[13px] text-gray-500">– {line.label}</span>
            <span className="text-[13px] text-red-400">
              {fmt(line.value)} <span className="text-gray-600 text-[11px]">({pct(line.pct)})</span>
            </span>
          </div>
        ))}

        <div className="flex justify-between py-2.5 border-t border-white/[0.06]">
          <span className="text-[13px] font-medium text-gray-400">Total Costos</span>
          <span className="text-[13px] font-bold text-red-400">{fmt(pnl.totalCosts)}</span>
        </div>

        <div className="flex justify-between py-3 border-t border-white/[0.10]">
          <span className="text-[14px] font-bold text-white">Profit</span>
          <span className={`text-[14px] font-bold ${pnl.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(pnl.profit)} <span className="text-[12px]">({pct(pnl.profitMargin)})</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function BreakevenSection({ be }) {
  if (!be) return null;

  const cards = [
    { label: 'ROAS Breakeven', value: be.roasBreakeven?.toFixed(2) + 'x' },
    { label: 'CPA Breakeven', value: fmt(be.cpaBreakeven) },
    { label: 'AOV Mínimo', value: fmt(be.aovMinimo) },
    { label: 'AOV Actual', value: fmt(be.aov) },
  ];

  return (
    <div className="card p-5">
      <p className="kpi-label mb-4">Breakeven</p>
      <div className="grid grid-cols-2 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white/[0.03] rounded-lg p-3.5 border border-white/[0.05]">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">{c.label}</p>
            <p className="text-[20px] font-bold text-white">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CSVUploadSection({ storeId, onUploaded }) {
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.post(
        `/api/stores/${storeId}/products/costs`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setResult(data);
      fileRef.current.value = '';
      if (onUploaded) onUploaded();
    } catch (err) {
      setResult({ error: err.response?.data?.error || 'Error' });
    }
    setUploading(false);
  };

  const downloadTemplate = (type) => {
    window.open(`/api/stores/${storeId}/products/costs/template?type=${type}`, '_blank');
  };

  return (
    <div className="card p-5">
      <p className="kpi-label mb-4">Importar costos de productos (CSV)</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {['productos', 'comisiones', 'envio', 'adicionales'].map((t) => (
          <button
            key={t}
            onClick={() => downloadTemplate(t)}
            className="chip"
          >
            Plantilla {t}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="text-[12px] text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[12px] file:font-medium file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 file:transition"
        />
        <button onClick={handleUpload} disabled={uploading} className="btn-primary disabled:opacity-50">
          {uploading ? 'Subiendo...' : 'Subir CSV'}
        </button>
      </div>

      {result && !result.error && (
        <p className="mt-3 text-[12px] text-emerald-400">
          Actualizados: {result.updated}
          {result.notFound?.length > 0 && ` | No encontrados: ${result.notFound.join(', ')}`}
        </p>
      )}
      {result?.error && <p className="mt-3 text-[12px] text-red-400">{result.error}</p>}
    </div>
  );
}

export default function Costos() {
  const { storeId } = useParams();
  const { from, to } = useSelector((s) => s.date);
  const [pnl, setPnl] = useState(null);
  const [breakeven, setBreakeven] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const [pnlRes, beRes] = await Promise.all([
        api.get(`/api/stores/${storeId}/pnl`, { params }),
        api.get(`/api/stores/${storeId}/breakeven`, { params }),
      ]);
      setPnl(pnlRes.data);
      setBreakeven(beRes.data);
    } catch {
      setPnl(null);
      setBreakeven(null);
    }
    setLoading(false);
  }, [storeId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="text-center py-12 text-gray-600 text-[13px]">Cargando costos...</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Costos & P&L</h1>
        <p className="page-subtitle">Análisis de rentabilidad y punto de equilibrio del período.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PnLSection pnl={pnl} />
        <BreakevenSection be={breakeven} />
      </div>

      <CSVUploadSection storeId={storeId} onUploaded={fetchData} />

      <AIAnalysisPanel storeId={storeId} section="costos" from={from} to={to} />
    </div>
  );
}