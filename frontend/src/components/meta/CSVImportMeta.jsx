import { useState, useRef } from 'react';
import api from '../../services/api';

export default function CSVImportMeta({ storeId, onImported }) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef();

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
      fileRef.current.value = '';
      if (onImported) onImported();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al importar CSV');
    }
    setUploading(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Importar CSV de Meta Ads Manager
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Exportá desde Ads Manager → Informes → Exportar (.csv). Se aceptan columnas en inglés o español.
      </p>

      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-400"
        />
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {uploading ? 'Importando...' : 'Importar'}
        </button>
      </div>

      {error && (
        <div className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {result && (
        <div className="mt-3 text-sm text-green-600 dark:text-green-400">
          Importado: {result.campaignsCreated || 0} campañas, {result.insightsUpserted || 0} registros de insights.
        </div>
      )}
    </div>
  );
}
