import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../../services/api';

function StepGuide() {
  const steps = [
    { n: 1, title: 'Abrí Ads Manager', desc: 'Entrá a Meta Ads Manager → Informes (o la tabla de campañas).' },
    { n: 2, title: 'Seleccioná columnas', desc: 'Asegurate de incluir: Campaign name, Day, Amount spent, Impressions, Clicks (all). Opcionalmente: Purchases, ROAS, Reach, Link clicks, etc.' },
    { n: 3, title: 'Elegí el rango de fechas', desc: 'Seleccioná el período que querés importar. Podés importar el mismo rango varias veces (se actualiza sin duplicar).' },
    { n: 4, title: 'Exportá como CSV', desc: 'Hacé clic en "Exportar" → seleccioná formato CSV (.csv). Se aceptan columnas en inglés o español.' },
    { n: 5, title: 'Subí el archivo acá', desc: 'Usá el botón de abajo para cargar el CSV. Se validarán las columnas antes de importar.' },
  ];

  return (
    <div className="mb-4">
      <h4 className="kpi-label mb-2">Cómo exportar desde Ads Manager</h4>
      <div className="space-y-2">
        {steps.map((s) => (
          <div key={s.n} className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center">
              {s.n}
            </span>
            <div>
              <p className="text-[12px] font-medium text-white">{s.title}</p>
              <p className="text-[11px] text-gray-500">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ValidationResult({ validation }) {
  if (!validation) return null;

  return (
    <div className={`mt-3 p-3 rounded-lg border text-[12px] ${
      validation.isValid
        ? 'bg-emerald-500/10 border-emerald-500/20'
        : 'bg-red-500/10 border-red-500/20'
    }`}>
      <p className={`font-medium ${validation.isValid ? 'text-emerald-400' : 'text-red-400'}`}>
        {validation.isValid ? `CSV válido — ${validation.totalRows} filas detectadas` : 'CSV con problemas'}
      </p>

      {validation.detected?.length > 0 && (
        <div className="mt-2">
          <p className="text-[11px] text-gray-500 mb-1">Columnas detectadas:</p>
          <div className="flex flex-wrap gap-1">
            {validation.detected.map((col) => (
              <span key={col} className="chip chip-active text-[10px]">
                {col}
              </span>
            ))}
          </div>
        </div>
      )}

      {validation.missing?.length > 0 && (
        <div className="mt-2">
          <p className="text-[11px] text-red-400 mb-1">Columnas faltantes (requeridas):</p>
          <div className="flex flex-wrap gap-1">
            {validation.missing.map((col) => (
              <span key={col} className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400">
                {col}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ImportResult({ result }) {
  if (!result) return null;

  return (
    <div className="mt-3 p-3 rounded-lg border bg-blue-500/10 border-blue-500/20 text-[12px]">
      <p className="font-medium text-blue-400">
        Importadas {result.imported} de {result.total} filas
      </p>
      {result.dateRange && (
        <p className="text-[11px] text-gray-500 mt-1">
          Rango: {result.dateRange.from} → {result.dateRange.to}
        </p>
      )}
      {result.errors?.length > 0 && (
        <div className="mt-2">
          <p className="text-[11px] text-red-400">Errores ({result.errors.length}):</p>
          <ul className="text-[11px] text-red-500 mt-1 space-y-0.5">
            {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function ImportHistory({ history }) {
  if (!history || history.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="kpi-label mb-2">Historial de importaciones</h4>
      <div className="overflow-x-auto">
        <table className="w-full table-dark">
          <thead>
            <tr>
              {['Archivo', 'Fecha', 'Filas', 'Rango', 'Estado'].map((h) => (
                <th key={h} className="text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h._id}>
                <td className="max-w-[150px] truncate">{h.fileName}</td>
                <td>{new Date(h.createdAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td>{h.rowsImported}/{h.rowsTotal}</td>
                <td>
                  {h.dateRangeFrom ? `${new Date(h.dateRangeFrom).toLocaleDateString('es-AR')} - ${new Date(h.dateRangeTo).toLocaleDateString('es-AR')}` : '—'}
                </td>
                <td>
                  <span className={`badge ${
                    h.status === 'success' ? 'badge-green' :
                    h.status === 'partial' ? 'badge-amber' :
                    'badge-red'
                  }`}>
                    {h.status === 'success' ? 'OK' : h.status === 'partial' ? 'Parcial' : 'Error'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CSVImportMeta({ storeId, onImported }) {
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [showGuide, setShowGuide] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/stores/${storeId}/meta/import-history`);
      setHistory(data);
    } catch {}
  }, [storeId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleFileChange = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setValidation(null);
    setResult(null);
    setError(null);
    setValidating(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post(
        `/api/stores/${storeId}/meta/import/validate`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setValidation(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al validar CSV');
    }
    setValidating(false);
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post(
        `/api/stores/${storeId}/meta/import`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setResult(data);
      setValidation(null);
      fileRef.current.value = '';
      fetchHistory();
      if (onImported) onImported();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al importar CSV');
    }
    setUploading(false);
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="kpi-label">Importar CSV de Meta Ads Manager</h3>
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="text-[11px] text-blue-400 hover:text-blue-300 transition"
        >
          {showGuide ? 'Ocultar guía' : 'Cómo exportar?'}
        </button>
      </div>

      {showGuide && <StepGuide />}

      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="text-[12px] text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[11px] file:font-medium file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 transition"
        />
        <button
          onClick={handleUpload}
          disabled={uploading || validating || (validation && !validation.isValid)}
          className="btn-primary disabled:opacity-50"
        >
          {uploading ? 'Importando...' : validating ? 'Validando...' : 'Importar'}
        </button>
      </div>

      {error && <div className="mt-3 text-[12px] text-red-400">{error}</div>}

      <ValidationResult validation={validation} />
      <ImportResult result={result} />
      <ImportHistory history={history} />
    </div>
  );
}
