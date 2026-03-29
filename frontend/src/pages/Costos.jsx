import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';

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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase">
        P&L del período
      </h3>

      <div className="space-y-1">
        {/* Revenue */}
        <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
          <span className="font-medium text-gray-900 dark:text-gray-100">Revenue</span>
          <span className="font-bold text-gray-900 dark:text-gray-100">{fmt(pnl.revenue)}</span>
        </div>

        {/* Cost lines */}
        {pnl.lines?.map((line) => (
          <div key={line.label} className="flex justify-between py-1.5 text-sm">
            <span className="text-gray-600 dark:text-gray-400">– {line.label}</span>
            <span className="text-red-500">
              {fmt(line.value)} <span className="text-gray-400 text-xs">({pct(line.pct)})</span>
            </span>
          </div>
        ))}

        {/* Total costs */}
        <div className="flex justify-between py-2 border-t border-gray-200 dark:border-gray-600">
          <span className="font-medium text-gray-700 dark:text-gray-300">Total Costos</span>
          <span className="font-bold text-red-500">{fmt(pnl.totalCosts)}</span>
        </div>

        {/* Profit */}
        <div className="flex justify-between py-2 border-t-2 border-gray-300 dark:border-gray-500">
          <span className="font-semibold text-gray-900 dark:text-gray-100">Profit</span>
          <span className={`font-bold ${pnl.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {fmt(pnl.profit)} ({pct(pnl.profitMargin)})
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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase">
        Breakeven
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label}>
            <p className="text-xs text-gray-500 uppercase">{c.label}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{c.value}</p>
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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase">
        Importar costos de productos (CSV)
      </h3>

      <div className="flex flex-wrap gap-2 mb-3">
        {['productos', 'comisiones', 'envio', 'adicionales'].map((t) => (
          <button
            key={t}
            onClick={() => downloadTemplate(t)}
            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Plantilla {t}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <input ref={fileRef} type="file" accept=".csv" className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100" />
        <button onClick={handleUpload} disabled={uploading} className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50">
          {uploading ? 'Subiendo...' : 'Subir'}
        </button>
      </div>

      {result && !result.error && (
        <p className="mt-2 text-sm text-green-600">
          Actualizados: {result.updated}
          {result.notFound?.length > 0 && ` | No encontrados: ${result.notFound.join(', ')}`}
        </p>
      )}
      {result?.error && <p className="mt-2 text-sm text-red-600">{result.error}</p>}
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Cargando costos...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Costos & P&L</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PnLSection pnl={pnl} />
        <BreakevenSection be={breakeven} />
      </div>

      <CSVUploadSection storeId={storeId} onUploaded={fetchData} />
    </div>
  );
}
