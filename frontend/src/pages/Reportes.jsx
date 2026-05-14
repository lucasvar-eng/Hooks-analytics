import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import { renderMarkdown } from '../utils/markdown';

const TIPO_LABELS = {
  analysis: 'Análisis',
  report: 'Reporte',
  diagnostic: 'Diagnóstico',
};

const AUDIENCE_LABELS = {
  gerencial: 'Gerencial',
  operativo: 'Operativo',
  cliente: 'Cliente',
};

const AUDIENCE_BADGE = {
  gerencial: 'bg-blue-500/15 text-blue-300',
  operativo: 'bg-emerald-500/15 text-emerald-300',
  cliente: 'bg-purple-500/15 text-purple-300',
};

const FREQUENCY_LABEL = {
  'on-demand': 'Bajo demanda',
  weekly: 'Semanal',
  monthly: 'Mensual',
};

export default function Reportes() {
  const { storeId } = useParams();
  const { from, to } = useSelector((state) => state.date);
  const [reports, setReports] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [briefingFor, setBriefingFor] = useState(null);
  const [briefingData, setBriefingData] = useState(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [copiedAt, setCopiedAt] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [reportsRes, templatesRes] = await Promise.all([
        api.get(`/api/stores/${storeId}/reports`),
        api.get('/api/reports/templates'),
      ]);
      setReports(Array.isArray(reportsRes.data) ? reportsRes.data : []);
      setTemplates(Array.isArray(templatesRes.data) ? templatesRes.data : []);
    } catch {
      setReports([]);
      setTemplates([]);
    }
    setLoading(false);
  }, [storeId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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
    if (!window.confirm('¿Eliminar este reporte? No se puede deshacer.')) return;
    try {
      await api.delete(`/api/stores/${storeId}/reports/${id}`);
      fetchAll();
    } catch {}
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

  const handleGetBriefing = async (template) => {
    setBriefingFor(template);
    setBriefingLoading(true);
    setBriefingData(null);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const { data } = await api.get(
        `/api/stores/${storeId}/reports/templates/${template.key}/briefing`,
        { params },
      );
      setBriefingData(data);
    } catch (err) {
      setBriefingData({ error: err?.response?.data?.error || err.message || 'No se pudo obtener el briefing' });
    }
    setBriefingLoading(false);
  };

  const handleCopyBriefing = async () => {
    if (!briefingData) return;
    try {
      const text = JSON.stringify(briefingData, null, 2);
      await navigator.clipboard.writeText(text);
      setCopiedAt(Date.now());
      setTimeout(() => setCopiedAt(null), 2500);
    } catch {}
  };

  const closeBriefing = () => {
    setBriefingFor(null);
    setBriefingData(null);
    setCopiedAt(null);
  };

  if (loading || detailLoading) {
    return <div className="text-center py-12 text-[13px] text-app-secondary">Cargando reportes...</div>;
  }

  // Detail view
  if (selected) {
    return <ReportDetail report={selected} onBack={() => setSelected(null)} onExport={handleExport} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="page-subtitle">Bandeja de análisis generados por IA externa vía MCP.</p>
        </div>
        <span className="text-[12px] text-app-secondary">
          {reports.length} {reports.length === 1 ? 'reporte' : 'reportes'}
        </span>
      </div>

      {/* Generar briefing para IA externa */}
      <div className="card p-5">
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-blue-300">Generar briefing para IA</p>
          <p className="text-[13px] text-gray-200 mt-1.5 leading-relaxed">
            Cada template arma un briefing con la estructura del reporte + métricas reales pre-calculadas + system prompt sugerido. Tocá un template para verlo, copiarlo, y pegarlo en Claude Desktop u otra IA. La IA completa y sube el reporte vía MCP — aparece abajo en la bandeja.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map((tmpl) => (
            <TemplateCard
              key={tmpl.key}
              template={tmpl}
              onClick={() => handleGetBriefing(tmpl)}
            />
          ))}
        </div>
      </div>

      {/* Bandeja de reportes */}
      {reports.length === 0 ? (
        <div className="text-center py-12 px-6 border border-dashed border-white/[0.1] rounded-xl">
          <p className="text-[14px] text-white font-semibold">Bandeja vacía</p>
          <p className="text-[12.5px] text-app-secondary mt-2 max-w-[480px] mx-auto leading-relaxed">
            Esperando que la IA externa suba un reporte vía MCP. Mientras tanto, podés generar un briefing arriba para que tu IA lo complete.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                <th className="text-left text-[10px] font-bold uppercase tracking-[1.2px] text-gray-300 px-4 py-3">Título</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-[1.2px] text-gray-300 px-2 py-3">Sección</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-[1.2px] text-gray-300 px-2 py-3">Fecha</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-[1.2px] text-gray-300 px-2 py-3">Origen</th>
                <th className="text-left text-[10px] font-bold uppercase tracking-[1.2px] text-gray-300 px-2 py-3">Resumen</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr
                  key={r._id}
                  onClick={() => handleSelect(r)}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer"
                >
                  <td className="px-4 py-3 text-[12.5px] font-medium text-white max-w-[320px]">
                    <div className="truncate">{r.titulo}</div>
                    {r.tipo && (
                      <span className="inline-block mt-1 text-[10px] text-gray-400">
                        {TIPO_LABELS[r.tipo] || r.tipo}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    {r.section ? (
                      <span className="inline-block bg-blue-500/12 text-blue-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                        {r.section}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[11px]">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-[11.5px] text-gray-200 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="px-2 py-3 text-[11px] text-gray-300">
                    {r.provider || r.model ? (
                      <div className="flex flex-col">
                        {r.provider && <span className="text-emerald-300">{r.provider}</span>}
                        {r.model && <span className="text-gray-400 text-[10.5px]">{r.model}</span>}
                      </div>
                    ) : (
                      <span className="text-gray-400">manual</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-[11.5px] text-gray-200 max-w-[280px]">
                    <div className="truncate">{r.summary || '—'}</div>
                  </td>
                  <td className="px-2 py-3 text-right">
                    <button
                      onClick={(e) => handleDelete(e, r._id)}
                      className="text-[11px] text-gray-400 hover:text-red-300 transition"
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

      {briefingFor && (
        <BriefingModal
          template={briefingFor}
          data={briefingData}
          loading={briefingLoading}
          copiedAt={copiedAt}
          onCopy={handleCopyBriefing}
          onClose={closeBriefing}
        />
      )}
    </div>
  );
}

function TemplateCard({ template, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card p-4 text-left hover:border-white/[0.18] hover:bg-white/[0.04] transition"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[13.5px] font-bold text-white leading-tight">{template.label}</p>
        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide flex-shrink-0 ${AUDIENCE_BADGE[template.audience] || 'bg-white/[0.06] text-gray-300'}`}>
          {AUDIENCE_LABELS[template.audience] || template.audience}
        </span>
      </div>
      <p className="text-[12px] text-gray-200 leading-snug">{template.description}</p>
      <div className="mt-3 flex items-center gap-2 flex-wrap text-[10.5px] text-gray-300">
        <span>{template.sectionCount} secciones</span>
        <span className="opacity-50">·</span>
        <span>{FREQUENCY_LABEL[template.frequency] || template.frequency}</span>
        <span className="opacity-50">·</span>
        <span className="text-blue-300 font-medium">Generar briefing →</span>
      </div>
    </button>
  );
}

function BriefingModal({ template, data, loading, copiedAt, onCopy, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sections = data?.structure || [];
  const metricsBlock = data?.metricsBlock || {};

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-6 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-[#131316] border border-white/[0.08] rounded-2xl max-w-[960px] w-full max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start px-7 py-5 border-b border-white/[0.06] sticky top-0 bg-[#131316] z-10 gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[18px] font-bold text-white">Briefing: {template.label}</p>
            <p className="text-[12.5px] text-gray-300 mt-1">{template.description}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onCopy}
              disabled={!data || data.error}
              className="bg-blue-500/15 border border-blue-500/35 text-blue-200 hover:bg-blue-500/25 px-4 py-2 rounded-lg text-[12.5px] font-semibold disabled:opacity-50"
            >
              {copiedAt ? '✓ Copiado al portapapeles' : 'Copiar JSON al portapapeles'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-white/[0.04] border border-white/[0.08] w-9 h-9 rounded-full text-white text-[16px] hover:bg-white/[0.1]"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-7 py-6 space-y-5">
          {loading && (
            <div className="text-center py-10">
              <p className="text-[13px] text-gray-200">Armando briefing y cargando métricas...</p>
              <p className="text-[11.5px] text-gray-400 mt-1">Puede tardar unos segundos según la cantidad de data.</p>
            </div>
          )}

          {!loading && data?.error && (
            <div className="rounded-xl bg-red-500/[0.05] border border-red-500/20 p-4">
              <p className="text-[13px] text-red-200 font-semibold">No se pudo generar el briefing</p>
              <p className="text-[12px] text-red-200/80 mt-1.5 leading-relaxed">{data.error}</p>
            </div>
          )}

          {!loading && data && !data.error && (
            <>
              <div className="rounded-xl bg-blue-500/[0.04] border border-blue-500/15 p-4">
                <p className="text-[10.5px] font-bold uppercase tracking-[1.3px] text-blue-300">Cómo usarlo</p>
                <ol className="text-[12.5px] text-gray-100 mt-2 leading-relaxed list-decimal pl-5 space-y-1">
                  <li>Click en <strong className="text-white">Copiar JSON al portapapeles</strong> y pegalo en Claude Desktop / Codex / otra IA.</li>
                  <li>La IA lee el <code className="text-blue-200 text-[11.5px]">metricsBlock</code> (datos reales) y completa cada sección de <code className="text-blue-200 text-[11.5px]">structure</code> respetando el guidance.</li>
                  <li>Cuando termine, te devuelve un markdown final.</li>
                  <li>La IA sube el reporte con <code className="text-blue-200 text-[11.5px]">create_report</code> (MCP) o vos lo pegás manualmente en la app.</li>
                </ol>
              </div>

              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[1.3px] text-gray-300 mb-2">Título sugerido</p>
                <p className="text-[14px] text-white">{data.suggestedTitle}</p>
              </div>

              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[1.3px] text-gray-300 mb-2">Estructura del reporte ({sections.length} secciones)</p>
                <div className="flex flex-col gap-2">
                  {sections.map((s, idx) => (
                    <div key={s.id} className="rounded-lg bg-white/[0.025] border border-white/[0.06] p-3.5">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-[10px] font-bold text-gray-300">{idx + 1}.</span>
                        <p className="text-[13px] font-semibold text-white">{s.title}</p>
                        <span className="bg-white/[0.05] border border-white/[0.08] text-gray-300 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                          {s.type}
                        </span>
                      </div>
                      <p className="text-[12px] text-gray-200 leading-relaxed">{s.guidance}</p>
                      {s.checklist && s.checklist.length > 0 && (
                        <ul className="mt-2 text-[11.5px] text-gray-300 space-y-0.5 pl-4">
                          {s.checklist.map((c, i) => <li key={i} className="list-disc">{c}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[1.3px] text-gray-300 mb-2">
                  Métricas pre-calculadas ({Object.keys(metricsBlock).length} campos)
                </p>
                <pre className="rounded-lg bg-white/[0.025] border border-white/[0.06] p-3 text-[11px] text-gray-100 overflow-x-auto max-h-[280px] overflow-y-auto">
                  {JSON.stringify(metricsBlock, null, 2)}
                </pre>
              </div>

              {data.systemPromptHint && (
                <div className="rounded-lg bg-white/[0.025] border border-white/[0.06] p-3.5">
                  <p className="text-[10.5px] font-bold uppercase tracking-[1.3px] text-gray-300 mb-1.5">System prompt sugerido</p>
                  <p className="text-[12px] text-gray-200 leading-relaxed">{data.systemPromptHint}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Detalle de reporte con TOC sticky a la izquierda
// ============================================================================

function ReportDetail({ report, onBack, onExport }) {
  const sections = useMemo(() => extractHeadings(report.contenido || ''), [report.contenido]);
  const [activeSlug, setActiveSlug] = useState(sections[0]?.slug || null);

  useEffect(() => {
    const onScroll = () => {
      for (const s of sections) {
        const el = document.getElementById(s.slug);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top >= 0 && rect.top < 220) {
          setActiveSlug(s.slug);
          return;
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sections]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[12px] text-gray-300 hover:text-white transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a la bandeja
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => onExport(report, 'markdown')} className="bg-white/[0.04] border border-white/[0.08] text-gray-200 hover:bg-white/[0.08] hover:text-white px-3 py-1.5 rounded-lg text-[11.5px] font-medium">Descargar MD</button>
          <button onClick={() => onExport(report, 'json')} className="bg-blue-500/15 border border-blue-500/35 text-blue-200 hover:bg-blue-500/25 px-3 py-1.5 rounded-lg text-[11.5px] font-medium">Descargar JSON</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
        {/* TOC sticky */}
        {sections.length > 0 && (
          <aside className="hidden lg:block">
            <div className="sticky top-4 max-h-[80vh] overflow-y-auto">
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300 mb-3">Índice</p>
              <nav className="flex flex-col gap-1.5">
                {sections.map((s) => (
                  <a
                    key={s.slug}
                    href={`#${s.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(s.slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      setActiveSlug(s.slug);
                    }}
                    className={`text-[12px] leading-snug transition pl-${(s.level - 1) * 3}
                      ${activeSlug === s.slug ? 'text-blue-300 font-semibold' : 'text-gray-300 hover:text-white'}`}
                  >
                    {s.text}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        )}

        {/* Contenido */}
        <div className="card p-6 min-w-0">
          <h2 className="text-[18px] font-bold text-white">{report.titulo}</h2>

          <div className="flex items-center gap-2 mt-3 mb-4 flex-wrap">
            {report.section && (
              <span className="inline-block bg-blue-500/12 text-blue-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                {report.section}
              </span>
            )}
            {report.tipo && (
              <span className="inline-block bg-white/[0.06] text-gray-300 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                {TIPO_LABELS[report.tipo] || report.tipo}
              </span>
            )}
            <span className="text-[11.5px] text-gray-300">
              {new Date(report.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
            {report.provider && (
              <span className="text-[11px] text-emerald-300 font-medium">via {report.provider}</span>
            )}
            {report.model && (
              <span className="text-[11px] text-gray-300">· {report.model}</span>
            )}
            {report.confidence != null && (
              <span className="text-[11px] text-gray-300">· Confianza {(report.confidence * 100).toFixed(0)}%</span>
            )}
          </div>

          {report.summary && (
            <p className="text-[13px] text-gray-100 mb-4 leading-relaxed">{report.summary}</p>
          )}

          {report.qualityNote && (
            <div className="rounded-lg border border-amber-500/15 bg-amber-500/[0.04] p-3 mb-5">
              <p className="text-[11.5px] text-amber-200">{report.qualityNote}</p>
            </div>
          )}

          <div
            className="markdown-body text-[13px] leading-relaxed text-gray-100"
            dangerouslySetInnerHTML={{ __html: renderMarkdownWithIds(report.contenido) }}
          />
        </div>
      </div>
    </div>
  );
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
    .replace(/^-|-$/g, '').slice(0, 80);
}

function extractHeadings(markdown) {
  if (!markdown) return [];
  const lines = markdown.split('\n');
  const headings = [];
  const seen = new Map();
  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+?)\s*$/);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].trim();
    let slug = slugify(text);
    const count = seen.get(slug) || 0;
    if (count > 0) slug = `${slug}-${count + 1}`;
    seen.set(slug, count + 1);
    headings.push({ level, text, slug });
  }
  return headings;
}

function renderMarkdownWithIds(markdown) {
  const html = renderMarkdown(markdown || '');
  // Inyectar id en h1/h2/h3 para que el TOC pueda hacer anchor
  const seen = new Map();
  return html.replace(/<(h[1-3])>(.+?)<\/\1>/g, (_, tag, inner) => {
    const text = inner.replace(/<[^>]+>/g, '');
    let slug = slugify(text);
    const count = seen.get(slug) || 0;
    if (count > 0) slug = `${slug}-${count + 1}`;
    seen.set(slug, count + 1);
    return `<${tag} id="${slug}">${inner}</${tag}>`;
  });
}
