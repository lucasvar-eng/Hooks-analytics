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
      const { data } = await api.post(`/api/stores/${storeId}/ai/analyze`, { section, from, to });
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
        provider: analysis.provider,
        confidence: analysis.confidence,
        qualityNote: analysis.qualityNote,
        generationMode: analysis.generationMode || 'ai',
      });
      setSaveSuccess(true);
    } catch {
      setSaveSuccess(false);
    }
    setSaving(false);
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Análisis AI</p>
        <button onClick={handleAnalyze} disabled={loading} className="btn-primary text-[11px] disabled:opacity-50">
          {loading ? 'Analizando...' : 'Generar análisis'}
        </button>
      </div>

      {error && <p className="text-[12px] text-red-400 mb-2">{error}</p>}

      {analysis && (
        <div className="text-[12px] leading-relaxed text-app-primary space-y-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {analysis.confidence != null && (
              <span className={`badge ${
                analysis.confidence >= 0.8
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : analysis.confidence >= 0.5
                    ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-red-500/15 text-red-400'
              }`}>
                Confianza {(analysis.confidence * 100).toFixed(0)}%
              </span>
            )}
            {analysis.qualityNote && (
              <span className="text-[11px] text-app-secondary">{analysis.qualityNote}</span>
            )}
          </div>

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
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.06]">
            {analysis.tokensUsed && (
              <p className="text-[10px] text-app-secondary">{analysis.tokensUsed} tokens · {analysis.model}</p>
            )}
            <button onClick={handleSave} disabled={saving} className="btn-ghost text-[11px] disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar análisis'}
            </button>
            {saveSuccess && <span className="text-[11px] text-emerald-400">Guardado</span>}
          </div>
        </div>
      )}

      {!analysis && !loading && !error && (
        <p className="text-[12px] text-app-secondary">
          Hacé click en "Generar análisis" para obtener insights de AI sobre esta sección.
        </p>
      )}
    </div>
  );
}
