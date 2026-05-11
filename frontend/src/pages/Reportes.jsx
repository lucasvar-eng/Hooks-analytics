import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import { renderMarkdown } from '../utils/markdown';

function formatRatioDisplay(value) {
  if (value == null) return '—';
  if (typeof value === 'number' && Number.isFinite(value)) return `${value.toFixed(2)}x`;
  const text = String(value).trim();
  if (!text) return '—';
  return text;
}

const TIPO_LABELS = {
  analysis: 'Análisis',
  report: 'Reporte',
  diagnostic: 'Diagnóstico',
};

const GENERATION_LABELS = {
  ai: 'AI real',
  fallback: 'Fallback',
  manual: 'Manual',
};

const REPORT_TEMPLATES = [
  {
    key: 'executive',
    title: 'Reporte ejecutivo de tienda',
    description: 'Foto rápida del negocio con facturación, ganancia, ROAS y riesgos del período.',
  },
  {
    key: 'meta-performance',
    title: 'Reporte de performance Meta',
    description: 'Lectura de inversión, compras, ROAS, CPA y top campañas del período.',
  },
  {
    key: 'creative-framework',
    title: 'Reporte creativo y mensaje',
    description: 'Pipeline creativo, gaps del framework y backlog inicial de próximos tests.',
  },
];

export default function Reportes() {
  const { storeId } = useParams();
  const { from, to } = useSelector((state) => state.date);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/stores/${storeId}/reports`);
      setReports(Array.isArray(data) ? data : []);
    } catch {
      setReports([]);
    }
    setLoading(false);
  }, [storeId]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleSelect = async (report) => {
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/api/stores/${storeId}/reports/${report._id}`);
      setSelected(data || null);
    } catch {
      setSelected(null);
    }
    setDetailLoading(false);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await api.delete(`/api/stores/${storeId}/reports/${id}`);
      fetchList();
    } catch {}
  };

  const handleCreateTemplate = async (templateKey) => {
    setCreatingTemplate(templateKey);
    try {
      await api.post(`/api/stores/${storeId}/reports/templates/${templateKey}`, { from, to });
      await fetchList();
    } catch {}
    setCreatingTemplate(null);
  };

  const handleExport = async (report, format = 'json') => {
    try {
      const { data } = await api.get(`/api/stores/${storeId}/reports/${report._id}/export?format=${format}`, {
        responseType: format === 'json' ? 'json' : 'text',
      });
      const body = format === 'json' ? JSON.stringify(data, null, 2) : data;
      const blob = new Blob([body], {
        type: format === 'json' ? 'application/json' : 'text/markdown',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.titulo.replace(/\s+/g, '-').toLowerCase()}.${format === 'json' ? 'json' : 'md'}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {}
  };

  if (loading || detailLoading) {
    return <div className="text-center py-12 text-[13px] text-app-secondary">Cargando reportes...</div>;
  }

  // Detail view
  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-1.5 text-[12px] text-app-secondary hover:text-app-accent transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => handleExport(selected, 'markdown')} className="btn-ghost">MD</button>
            <button onClick={() => handleExport(selected, 'json')} className="btn-primary">JSON</button>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-[15px] font-bold text-white mb-3">{selected.titulo}</h2>

          {selected.summary && (
            <p className="text-app-secondary text-[12px] mb-3">{selected.summary}</p>
          )}

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {selected.section && (
              <span className="badge-blue">{selected.section}</span>
            )}
            {selected.tipo && (
              <span className="badge-gray">{TIPO_LABELS[selected.tipo] || selected.tipo}</span>
            )}
            <span className="text-[11px] text-app-secondary">
              {new Date(selected.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
            {selected.tokensUsed > 0 && (
              <span className="text-[11px] text-app-secondary">{selected.tokensUsed} tokens</span>
            )}
            {selected.model && (
              <span className="text-[11px] text-app-secondary">{selected.model}</span>
            )}
            {selected.provider && (
              <span className="text-[11px] text-app-secondary">{selected.provider}</span>
            )}
            {selected.generationMode && (
              <span className={selected.generationMode === 'ai' ? 'badge-green' : selected.generationMode === 'fallback' ? 'badge-amber' : 'badge-gray'}>
                {GENERATION_LABELS[selected.generationMode] || selected.generationMode}
              </span>
            )}
            {selected.confidence != null && (
              <span className="text-[11px] text-app-secondary">Confianza {(selected.confidence * 100).toFixed(0)}%</span>
            )}
          </div>

          {selected.qualityNote && (
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 mb-4">
              <p className="text-[12px] text-app-secondary">{selected.qualityNote}</p>
            </div>
          )}

          {selected.snapshot?.metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-app-muted text-[10px] uppercase tracking-[0.18em]">Revenue</p>
                <p className="text-white text-lg font-semibold mt-1">${Math.round(selected.snapshot.metrics.revenue || 0).toLocaleString('es-AR')}</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-app-muted text-[10px] uppercase tracking-[0.18em]">Profit</p>
                <p className="text-white text-lg font-semibold mt-1">${Math.round(selected.snapshot.metrics.profit || 0).toLocaleString('es-AR')}</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-app-muted text-[10px] uppercase tracking-[0.18em]">ROAS</p>
                <p className="text-white text-lg font-semibold mt-1">{formatRatioDisplay(selected.snapshot.metrics.roas)}</p>
              </div>
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-app-muted text-[10px] uppercase tracking-[0.18em]">Target ROAS</p>
                <p className="text-white text-lg font-semibold mt-1">{selected.snapshot.target?.kpis?.roasTarget ?? '—'}</p>
              </div>
            </div>
          )}

          <div
            className="markdown-body text-[12px] leading-relaxed text-app-primary"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(selected.contenido) }}
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
          <p className="page-subtitle">Análisis guardados con snapshot para consulta y exportación.</p>
        </div>
        <span className="text-[12px] text-app-secondary">
          {reports.length} {reports.length === 1 ? 'reporte' : 'reportes'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {REPORT_TEMPLATES.map((template) => (
          <div key={template.key} className="card p-4">
            <p className="text-white font-semibold text-[14px]">{template.title}</p>
            <p className="text-app-secondary text-[12px] mt-2 leading-relaxed">{template.description}</p>
            <p className="text-app-muted text-[11px] mt-3">
              Rango actual: {from || 'inicio'} a {to || 'hoy'}
            </p>
            <button
              onClick={() => handleCreateTemplate(template.key)}
              disabled={creatingTemplate === template.key}
              className="btn-primary mt-4 w-full disabled:opacity-50"
            >
              {creatingTemplate === template.key ? 'Generando...' : 'Generar reporte'}
            </button>
          </div>
        ))}
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-12 text-[13px] text-app-secondary">
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
                <th className="text-left">Modo</th>
                <th className="text-right">Tokens</th>
                <th className="text-left">Resumen</th>
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
                      <span className="text-app-muted">—</span>
                    )}
                  </td>
                  <td className="text-[11px]">
                    {new Date(r.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td>
                    {r.generationMode ? (
                      <span className={r.generationMode === 'ai' ? 'badge-green' : r.generationMode === 'fallback' ? 'badge-amber' : 'badge-gray'}>
                        {GENERATION_LABELS[r.generationMode] || r.generationMode}
                      </span>
                    ) : (
                      <span className="text-app-muted">—</span>
                    )}
                  </td>
                  <td className="text-right tabular-nums">
                    {r.tokensUsed > 0 ? r.tokensUsed.toLocaleString('es-AR') : '—'}
                  </td>
                  <td className="text-[11px] text-app-secondary max-w-[260px] truncate">
                    {r.summary || '—'}
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
