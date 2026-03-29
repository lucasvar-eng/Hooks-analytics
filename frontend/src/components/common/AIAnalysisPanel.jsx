import { useState } from 'react';
import api from '../../services/api';

export default function AIAnalysisPanel({ storeId, section, from, to }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Análisis AI
        </h3>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="px-3 py-1.5 bg-violet-600 text-white text-sm rounded hover:bg-violet-700 disabled:opacity-50 transition"
        >
          {loading ? 'Analizando...' : 'Generar análisis'}
        </button>
      </div>

      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}

      {analysis && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
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
          {analysis.tokensUsed && (
            <p className="text-xs text-gray-400 mt-2">
              {analysis.tokensUsed} tokens | {analysis.model}
            </p>
          )}
        </div>
      )}

      {!analysis && !loading && !error && (
        <p className="text-xs text-gray-400">
          Hacé click en "Generar análisis" para obtener insights de AI sobre esta sección.
          Requiere API key de Anthropic configurada.
        </p>
      )}
    </div>
  );
}
