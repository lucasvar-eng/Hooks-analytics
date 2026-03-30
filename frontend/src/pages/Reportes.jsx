import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

function markdownToHtml(md) {
  return md
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*)/gm, '<h3>$1</h3>')
    .replace(/^## (.*)/gm, '<h2>$1</h2>')
    .replace(/^- (.*)/gm, '<li>$1</li>');
}

const TIPO_LABELS = {
  analysis: 'Análisis',
  report: 'Reporte',
  diagnostic: 'Diagnóstico',
};

export default function Reportes() {
  const { storeId } = useParams();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/stores/${storeId}/reports`);
      setReports(data);
    } catch {}
    setLoading(false);
  }, [storeId]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleSelect = async (report) => {
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/api/stores/${storeId}/reports/${report._id}`);
      setSelected(data);
    } catch {}
    setDetailLoading(false);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await api.delete(`/api/stores/${storeId}/reports/${id}`);
      fetchList();
    } catch {}
  };

  const handleBack = () => {
    setSelected(null);
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        Cargando reportes...
      </div>
    );
  }

  // Detail view
  if (detailLoading) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        Cargando reporte...
      </div>
    );
  }

  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 hover:text-primary-500 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-primary-600 text-white text-[11px] font-semibold rounded hover:bg-primary-700 transition"
          >
            Exportar
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-5">
          <h2 className="text-[14px] font-bold text-gray-900 dark:text-white mb-2">
            {selected.titulo}
          </h2>

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {selected.section && (
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">
                {selected.section}
              </span>
            )}
            {selected.tipo && (
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                {TIPO_LABELS[selected.tipo] || selected.tipo}
              </span>
            )}
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {new Date(selected.createdAt).toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {selected.tokensUsed > 0 && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">{selected.tokensUsed} tokens</span>
            )}
            {selected.model && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">{selected.model}</span>
            )}
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
            <div
              dangerouslySetInnerHTML={{ __html: markdownToHtml(selected.contenido) }}
            />
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="section-label">Reportes</p>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {reports.length} {reports.length === 1 ? 'reporte' : 'reportes'}
        </span>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-12 text-[11px] text-gray-400 dark:text-gray-500">
          No hay reportes guardados aún. Generá un análisis AI en cualquier sección y guardalo.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-white/[0.02]">
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">
                  Título
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">
                  Sección
                </th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">
                  Fecha
                </th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">
                  Tokens
                </th>
                <th className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700/60" />
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr
                  key={r._id}
                  onClick={() => handleSelect(r)}
                  className="cursor-pointer border-b border-gray-100 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition"
                >
                  <td className="px-3 py-2.5 text-gray-900 dark:text-white font-medium">
                    {r.titulo}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.section ? (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">
                        {r.section}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">
                    {new Date(r.createdAt).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-500 dark:text-gray-400 tabular-nums">
                    {r.tokensUsed > 0 ? r.tokensUsed.toLocaleString('es-AR') : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={(e) => handleDelete(e, r._id)}
                      className="text-[10px] text-red-400 hover:text-red-600 transition"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
