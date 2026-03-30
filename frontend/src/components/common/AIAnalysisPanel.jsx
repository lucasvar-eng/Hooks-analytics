import { useState } from 'react';
import api from '../../services/api';

export default function AIAnalysisPanel({ storeId, section, from, to }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const { data } = await api.post(`/api/stores/${storeId}/ai/analyze`, {
        section,
        from,
        to,
      });
      setAnalysis(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al generar análisis');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    const defaultTitle = `Análisis ${section} - ${new Date().toLocaleDateString('es-AR')}`;
    const titulo = prompt('Título del reporte:', defaultTitle);
    if (titulo === null) return;

    setSaving(true);
    setSaveSuccess(false);
    try {
      await api.post(`/api/stores/${storeId}/reports`, {
        titulo,
        contenido: analysis.analysis,
        section,
        tipo: 'analysis',
        dateRange: { from, to },
        tokensUsed: analysis.tokensUsed,
        model: analysis.model,
      });
      setSaveSuccess(true);
    } catch {
      setSaveSuccess(false);
    }
    setSaving(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Análisis AI
        </h3>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="px-3 py-1.5 bg-primary-600 text-white text-[11px] font-semibold rounded hover:bg-primary-700 disabled:opacity-50 transition"
        >
          {loading ? 'Analizando...' : 'Generar análisis'}
        </button>
      </div>

      {error && <p className="text-[11px] text-red-500 dark:text-red-400 mb-2">{error}</p>}

      {analysis && (
        <div className="prose prose-sm dark:prose-invert max-w-none text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
          <div
            dangerouslySetInnerHTML={{
              __html: analysis.analysis
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/^### (.*)/gm, '<h3>$1</h3>')
                .replace(/^## (.*)/gm, '<h2>$1</h2>')
                .replace(/^- (.*)/gm, '<li>$1</li>'),
            }}
          />
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60">
            {analysis.tokensUsed && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                {analysis.tokensUsed} tokens · {analysis.model}
              </p>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-semibold rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition"
            >
              {saving ? 'Guardando...' : 'Guardar análisis'}
            </button>
            {saveSuccess && (
              <span className="text-[10px] text-green-500 dark:text-green-400">Guardado</span>
            )}
          </div>
        </div>
      )}

      {!analysis && !loading && !error && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          Hacé click en "Generar análisis" para obtener insights de AI sobre esta sección.
        </p>
      )}
    </div>
  );
}
