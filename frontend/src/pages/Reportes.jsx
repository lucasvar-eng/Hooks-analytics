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

  if (loading || detailLoading) {
    return <div className="text-center py-12 text-[13px] text-gray-600">Cargando reportes...</div>;
  }

  // Detail view
  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-blue-400 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <button onClick={() => window.print()} className="btn-primary">Exportar</button>
        </div>

        <div className="card p-5">
          <h2 className="text-[15px] font-bold text-white mb-3">{selected.titulo}</h2>

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {selected.section && (
              <span className="badge-blue">{selected.section}</span>
            )}
            {selected.tipo && (
              <span className="badge-gray">{TIPO_LABELS[selected.tipo] || selected.tipo}</span>
            )}
            <span className="text-[11px] text-gray-600">
              {new Date(selected.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
            {selected.tokensUsed > 0 && (
              <span className="text-[11px] text-gray-600">{selected.tokensUsed} tokens</span>
            )}
            {selected.model && (
              <span className="text-[11px] text-gray-600">{selected.model}</span>
            )}
          </div>

          <div
            className="text-[12px] leading-relaxed text-gray-400 space-y-1"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(selected.contenido) }}
          />
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="page-subtitle">Análisis generados por IA y guardados para consulta.</p>
        </div>
        <span className="text-[12px] text-gray-600">
          {reports.length} {reports.length === 1 ? 'reporte' : 'reportes'}
        </span>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-12 text-[13px] text-gray-600">
          No hay reportes guardados aún. Generá un análisis AI en cualquier sección y guardalo.
        </div>
      ) : (
        <div className="card">
          <table className="w-full table-dark">
            <thead>
              <tr>
                <th className="text-left">Título</th>
                <th className="text-left">Sección</th>
                <th className="text-left">Fecha</th>
                <th className="text-right">Tokens</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r._id} onClick={() => handleSelect(r)} className="cursor-pointer">
                  <td className="font-medium text-white">{r.titulo}</td>
                  <td>
                    {r.section ? (
                      <span className="badge-blue">{r.section}</span>
                    ) : (
                      <span className="text-gray-700">—</span>
                    )}
                  </td>
                  <td className="text-[11px]">
                    {new Date(r.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="text-right tabular-nums">
                    {r.tokensUsed > 0 ? r.tokensUsed.toLocaleString('es-AR') : '—'}
                  </td>
                  <td className="text-right">
                    <button
                      onClick={(e) => handleDelete(e, r._id)}
                      className="text-[11px] text-red-500 hover:text-red-400 transition"
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