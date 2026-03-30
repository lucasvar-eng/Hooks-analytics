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
      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
        Cómo exportar desde Ads Manager
      </h4>
      <div className="space-y-2">
        {steps.map((s) => (
          <div key={s.n} className="flex gap-3 items-start">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center">
              {s.n}
            </span>
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{s.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.desc}</p>
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
    <div className={`mt-3 p-3 rounded-lg border text-sm ${
      validation.isValid
        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    }`}>
      <p className={`font-medium ${validation.isValid ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
        {validation.isValid ? `CSV válido — ${validation.totalRows} filas detectadas` : 'CSV con problemas'}
      </p>

      {validation.detected?.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Columnas detectadas:</p>
          <div className="flex flex-wrap gap-1">
            {validation.detected.map((col) => (
              <span key={col} className="px-1.5 py-0.5 rounded text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                {col}
              </span>
            ))}
          </div>
        </div>
      )}

      {validation.missing?.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-red-600 dark:text-red-400 mb-1">Columnas faltantes (requeridas):</p>
          <div className="flex flex-wrap gap-1">
            {validation.missing.map((col) => (
              <span key={col} className="px-1.5 py-0.5 rounded text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">
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
    <div className="mt-3 p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-sm">
      <p className="font-medium text-blue-700 dark:text-blue-400">
        Importadas {result.imported} de {result.total} filas
      </p>
      {result.dateRange && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Rango: {result.dateRange.from} → {result.dateRange.to}
        </p>
      )}
      {result.errors?.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-red-600 dark:text-red-400">Errores ({result.errors.length}):</p>
          <ul className="text-xs text-red-500 mt-1 space-y-0.5">
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
      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
        Historial de importaciones
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-750">
              {['Archivo', 'Fecha', 'Filas', 'Rango', 'Estado'].map((h) => (
                <th key={h} className="px-2 py-1.5 text-left text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {history.map((h) => (
              <tr key={h._id}>
                <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300 max-w-[150px] truncate">{h.fileName}</td>
                <td className="px-2 py-1.5 text-gray-500">{new Date(h.createdAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{h.rowsImported}/{h.rowsTotal}</td>
                <td className="px-2 py-1.5 text-gray-500">
                  {h.dateRangeFrom ? `${new Date(h.dateRangeFrom).toLocaleDateString('es-AR')} - ${new Date(h.dateRangeTo).toLocaleDateString('es-AR')}` : '—'}
                </td>
                <td className="px-2 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    h.status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    h.status === 'partial' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase">
          Importar CSV de Meta Ads Manager
        </h3>
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
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
          className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-400"
        />
        <button
          onClick={handleUpload}
          disabled={uploading || validating || (validation && !validation.isValid)}
          className="px-4 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50 transition"
        >
          {uploading ? 'Importando...' : validating ? 'Validando...' : 'Importar'}
        </button>
      </div>

      {error && <div className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

      <ValidationResult validation={validation} />
      <ImportResult result={result} />
      <ImportHistory history={history} />
    </div>
  );
}
