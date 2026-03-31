import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import AIAnalysisPanel from '../components/common/AIAnalysisPanel';
import ClaudeActionBar from '../components/common/ClaudeActionBar';

function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildPipelineMarkdown({ from, to, pipeline, frameworkOverview, brief }) {
  const lines = [
    '# Pipeline creativo',
    '',
    `Período: ${from || 'inicio'} a ${to || 'hoy'}`,
    '',
    '## Resumen',
    `- Ads con spend: ${pipeline?.summary?.adsConSpend || 0}`,
    `- Escalar: ${pipeline?.summary?.escalar || 0}`,
    `- Pausar: ${pipeline?.summary?.pausar || 0}`,
    `- Testear: ${pipeline?.summary?.testear || 0}`,
  ];

  if (frameworkOverview?.summary) {
    lines.push('', '## Framework');
    lines.push(`- Topics: ${frameworkOverview.summary.topics || 0}`);
    lines.push(`- Hooks: ${frameworkOverview.summary.hooks || 0}`);
    lines.push(`- Objeciones sin respuesta: ${frameworkOverview.summary.unresolvedObjections || 0}`);
    lines.push(`- Competidores: ${frameworkOverview.summary.competitors || 0}`);
  }

  const appendItems = (title, items = []) => {
    lines.push('', `## ${title}`);
    if (!items.length) {
      lines.push('- Sin items en este bloque.');
      return;
    }
    items.forEach((item) => {
      lines.push(`- **${item.title}**: ${item.reason}`);
    });
  };

  appendItems('Escalar', pipeline?.escalar || []);
  appendItems('Pausar / revisar', pipeline?.pausar || []);
  appendItems('Testear después', pipeline?.testear || []);

  if (brief?.ideas?.length) {
    lines.push('', '## Brief AI');
    brief.ideas.forEach((idea) => {
      lines.push(`- **${idea.hook}** · ${idea.angle} · ${idea.format}: ${idea.why}`);
    });
  }

  return lines.join('\n');
}

function buildPipelineCsv(pipeline) {
  const rows = [['bucket', 'priority', 'title', 'reason', 'metaId']];

  for (const item of pipeline?.escalar || []) {
    rows.push(['escalar', item.priority || '', item.title || '', item.reason || '', item.metaId || '']);
  }
  for (const item of pipeline?.pausar || []) {
    rows.push(['pausar', item.priority || '', item.title || '', item.reason || '', item.metaId || '']);
  }
  for (const item of pipeline?.testear || []) {
    rows.push(['testear', item.priority || '', item.title || '', item.reason || '', item.metaId || '']);
  }

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function buildMasterSheetData({ from, to, pipeline, frameworkOverview, brief }) {
  const updatedAt = new Date().toISOString();
  const dateLabel = new Date().toISOString().slice(0, 10);
  const pipelineRows = [
    ...(pipeline?.escalar || []).map((item) => ({
      updated_at: updatedAt,
      period_from: from || '',
      period_to: to || '',
      bucket: 'escalar',
      priority: item.priority || '',
      title: item.title || '',
      reason: item.reason || '',
      meta_id: item.metaId || '',
      action: 'Escalar o duplicar ganador',
      owner: '',
      status: 'pendiente',
    })),
    ...(pipeline?.pausar || []).map((item) => ({
      updated_at: updatedAt,
      period_from: from || '',
      period_to: to || '',
      bucket: 'pausar',
      priority: item.priority || '',
      title: item.title || '',
      reason: item.reason || '',
      meta_id: item.metaId || '',
      action: 'Revisar, pausar o rehacer',
      owner: '',
      status: 'pendiente',
    })),
    ...(pipeline?.testear || []).map((item) => ({
      updated_at: updatedAt,
      period_from: from || '',
      period_to: to || '',
      bucket: 'testear',
      priority: item.priority || '',
      title: item.title || '',
      reason: item.reason || '',
      meta_id: item.metaId || '',
      action: 'Diseñar test o concepto nuevo',
      owner: '',
      status: 'backlog',
    })),
  ];

  const historicoRows = [
    {
      snapshot_date: dateLabel,
      period_from: from || '',
      period_to: to || '',
      ads_con_spend: pipeline?.summary?.adsConSpend || 0,
      escalar: pipeline?.summary?.escalar || 0,
      pausar: pipeline?.summary?.pausar || 0,
      testear: pipeline?.summary?.testear || 0,
      tier_a: pipeline?.summary?.tierA || 0,
      tier_b: pipeline?.summary?.tierB || 0,
      tier_d_e: pipeline?.summary?.tierDOrE || 0,
      brief_confidence: brief?.confidence != null ? Number((brief.confidence * 100).toFixed(0)) : '',
      note: brief?.title || 'Snapshot manual del pipeline creativo',
    },
  ];

  const backlogRows = [
    ...(pipeline?.testear || []).map((item) => ({
      created_at: dateLabel,
      source: 'pipeline',
      priority: item.priority || '',
      hypothesis: item.title || '',
      reason: item.reason || '',
      status: 'pendiente',
      linked_meta_id: item.metaId || '',
    })),
    ...((brief?.ideas || []).map((idea) => ({
      created_at: dateLabel,
      source: 'brief_ai',
      priority: idea.priority || 'medium',
      hypothesis: `${idea.hook} · ${idea.angle}`,
      reason: idea.why || '',
      status: 'pendiente',
      linked_meta_id: '',
    })) || []),
  ];

  const frameworkRows = [
    ...((frameworkOverview?.highlightedTopics || []).map((item) => ({
      type: 'topic',
      name: item.nombre || '',
      priority: item.priority || '',
      avatar: item.avatar || '',
      awareness_level: item.awarenessLevel || '',
      angle: item.angle || '',
      territory: item.territory || '',
      notes: item.stage || '',
    })) || []),
    ...((frameworkOverview?.strategicGaps?.missingResponses || []).map((item) => ({
      type: 'objection_gap',
      name: item.texto || '',
      priority: 'high',
      avatar: item.avatar || '',
      awareness_level: item.awarenessLevel || '',
      angle: '',
      territory: '',
      notes: 'Objeción sin respuesta',
    })) || []),
    ...((frameworkOverview?.strategicGaps?.competitorAngles || []).map((item) => ({
      type: 'angle_gap',
      name: item || '',
      priority: 'medium',
      avatar: '',
      awareness_level: '',
      angle: item || '',
      territory: '',
      notes: 'Detectado en competencia y no cubierto',
    })) || []),
    ...((frameworkOverview?.strategicGaps?.competitorTerritories || []).map((item) => ({
      type: 'territory_gap',
      name: item || '',
      priority: 'medium',
      avatar: '',
      awareness_level: '',
      angle: '',
      territory: item || '',
      notes: 'Territorio abierto por explorar',
    })) || []),
  ];

  return {
    documentName: `pipeline-creativo-maestro-${dateLabel}`,
    tabs: [
      {
        name: 'Pipeline actual',
        mode: 'overwrite',
        description: 'Vista operativa del momento. Se pisa en cada actualización.',
        columns: Object.keys(pipelineRows[0] || {
          updated_at: '',
          period_from: '',
          period_to: '',
          bucket: '',
          priority: '',
          title: '',
          reason: '',
          meta_id: '',
          action: '',
          owner: '',
          status: '',
        }),
        rows: pipelineRows,
      },
      {
        name: 'Histórico',
        mode: 'append',
        description: 'Snapshots por fecha para seguir evolución del pipeline.',
        columns: Object.keys(historicoRows[0] || {}),
        rows: historicoRows,
      },
      {
        name: 'Backlog tests',
        mode: 'append',
        description: 'Hipótesis y tests creativos pendientes.',
        columns: Object.keys(backlogRows[0] || {
          created_at: '',
          source: '',
          priority: '',
          hypothesis: '',
          reason: '',
          status: '',
          linked_meta_id: '',
        }),
        rows: backlogRows,
      },
      {
        name: 'Framework',
        mode: 'overwrite',
        description: 'Mapa de topics, gaps, territorios y ángulos vigentes.',
        columns: Object.keys(frameworkRows[0] || {
          type: '',
          name: '',
          priority: '',
          avatar: '',
          awareness_level: '',
          angle: '',
          territory: '',
          notes: '',
        }),
        rows: frameworkRows,
      },
    ],
  };
}

function buildMasterSheetMarkdown(masterSheet) {
  const lines = [
    '# Documento maestro para Google Sheets',
    '',
    'Este documento está pensado para mantenerse como un único Google Sheet con varias pestañas.',
    '',
  ];

  for (const tab of masterSheet?.tabs || []) {
    lines.push(`## ${tab.name}`);
    lines.push(`- Modo: ${tab.mode === 'overwrite' ? 'se sobreescribe' : 'se acumula'}`);
    lines.push(`- Uso: ${tab.description}`);
    lines.push(`- Columnas: ${(tab.columns || []).join(', ')}`);
    lines.push(`- Filas exportadas: ${tab.rows?.length || 0}`);
    lines.push('');
  }

  return lines.join('\n');
}

const TIER_STYLES = {
  A: { badge: 'badge-green', border: 'border-l-2 border-emerald-500' },
  B: { badge: 'badge-blue', border: 'border-l-2 border-blue-500' },
  C: { badge: 'badge-amber', border: 'border-l-2 border-amber-500' },
  D: { badge: 'bg-orange-500/15 text-orange-400 badge', border: 'border-l-2 border-orange-500' },
  E: { badge: 'badge-red', border: 'border-l-2 border-red-500' },
};

function AdCard({ ad }) {
  const tier = TIER_STYLES[ad.tier];
  const statusBadge =
    ad.status === 'ACTIVE'
      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
      : ad.status === 'PAUSED'
        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
        : 'bg-white/[0.04] text-app-secondary border-white/[0.08]';
  const hasSpend = Number(ad.metrics?.spend || 0) > 0;
  return (
    <div className={`card p-4 ${tier?.border || ''}`}>
      <div className="flex items-start gap-3">
        {ad.thumbnailUrl && (
          <img src={ad.thumbnailUrl} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={tier?.badge || 'badge-gray'}>{ad.tier || '?'}</span>
            <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusBadge}`}>
              {ad.status || 'UNKNOWN'}
            </span>
            <span className="text-[13px] font-medium text-gray-200 truncate">{ad.nombre}</span>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] text-app-secondary mb-2">
            <span className="font-mono">{ad.metaId}</span>
            {ad.parentId && <span className="font-mono">adset {ad.parentId}</span>}
            <span>{hasSpend ? 'Con gasto en el período' : 'Sin gasto en el período'}</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Spend', value: fmt(ad.metrics?.spend) },
              { label: 'ROAS', value: `${ad.metrics?.roas?.toFixed(2) || '—'}x` },
              { label: 'CPA', value: fmt(ad.metrics?.cpa) },
              { label: 'CTR', value: `${ad.metrics?.ctr?.toFixed(2) || '—'}%` },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[9px] text-gray-600 uppercase tracking-wide">{label}</p>
                <p className="text-[12px] font-semibold text-gray-200 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-gray-600">
            <span>{ad.metrics?.impressions?.toLocaleString() || 0} imp</span>
            <span className="text-gray-700">→</span>
            <span>{ad.metrics?.clicks?.toLocaleString() || 0} clicks</span>
            <span className="text-gray-700">→</span>
            <span>{ad.metrics?.purchases || 0} compras</span>
            <span className="text-gray-700">→</span>
            <span>{fmt(ad.metrics?.purchaseValue)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreativeHealthStrip({ ads, pipeline, frameworkOverview }) {
  const adsWithSpend = ads.filter((item) => Number(item.metrics?.spend || 0) > 0).length;
  const adsWithoutSpend = Math.max(ads.length - adsWithSpend, 0);
  const activeAds = ads.filter((item) => item.status === 'ACTIVE').length;
  const pausedAds = ads.filter((item) => item.status === 'PAUSED').length;
  const unresolvedFramework =
    (frameworkOverview?.strategicGaps?.missingResponses?.length || 0) +
    (frameworkOverview?.strategicGaps?.competitorAngles?.length || 0) +
    (frameworkOverview?.strategicGaps?.competitorTerritories?.length || 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {[
        ['Ads totales', ads.length],
        ['Con gasto', adsWithSpend],
        ['Sin gasto', adsWithoutSpend],
        ['Activos', activeAds],
        ['Pausados', pausedAds],
      ].map(([label, value]) => (
        <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">{label}</p>
          <p className="text-white text-lg font-semibold mt-1">{value}</p>
        </div>
      ))}
      <div className="lg:col-span-5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-app-secondary text-[12px]">
          Pipeline actual: <span className="text-white">{pipeline?.summary?.escalar || 0}</span> para escalar,
          <span className="text-white"> {pipeline?.summary?.pausar || 0}</span> para revisar,
          <span className="text-white"> {pipeline?.summary?.testear || 0}</span> para testear.
        </p>
        <span className="text-[12px] text-app-secondary">
          Gaps de framework detectados: <span className="text-white">{unresolvedFramework}</span>
        </span>
      </div>
    </div>
  );
}

function CampaignResultsTable({ campaigns }) {
  if (!campaigns || campaigns.length === 0) {
    return <p className="text-gray-600 text-[13px] text-center py-8">Sin datos de campañas.</p>;
  }

  const totals = campaigns.reduce(
    (acc, c) => {
      acc.spend += c.metrics?.spend || 0;
      acc.impressions += c.metrics?.impressions || 0;
      acc.reach += c.metrics?.reach || 0;
      acc.clicks += c.metrics?.clicks || 0;
      acc.purchases += c.metrics?.purchases || 0;
      acc.purchaseValue += c.metrics?.purchaseValue || 0;
      return acc;
    },
    { spend: 0, impressions: 0, reach: 0, clicks: 0, purchases: 0, purchaseValue: 0 }
  );
  totals.roas = totals.spend > 0 ? totals.purchaseValue / totals.spend : 0;
  totals.cpa = totals.purchases > 0 ? totals.spend / totals.purchases : 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-dark">
        <thead>
          <tr>
            {['Campaña', 'Spend', 'Reach', 'CTR', 'Compras', 'CPA', 'ROAS', 'Revenue'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c._id}>
              <td className="font-medium text-white truncate max-w-[200px]">{c.nombre}</td>
              <td>{fmt(c.metrics?.spend)}</td>
              <td>{(c.metrics?.reach || 0).toLocaleString()}</td>
              <td>{c.metrics?.ctr?.toFixed(2) || '—'}%</td>
              <td>{c.metrics?.purchases || 0}</td>
              <td>{fmt(c.metrics?.cpa)}</td>
              <td className="font-semibold">{c.metrics?.roas?.toFixed(2) || '—'}x</td>
              <td className="text-emerald-400 font-semibold">{fmt(c.metrics?.purchaseValue)}</td>
            </tr>
          ))}
          <tr className="bg-white/[0.03] font-semibold">
            <td className="text-white">TOTAL</td>
            <td>{fmt(totals.spend)}</td>
            <td>{totals.reach.toLocaleString()}</td>
            <td>{totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : '—'}%</td>
            <td>{totals.purchases}</td>
            <td>{fmt(totals.cpa)}</td>
            <td className="font-semibold">{totals.roas.toFixed(2)}x</td>
            <td className="text-emerald-400">{fmt(totals.purchaseValue)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function Creativos() {
  const { storeId } = useParams();
  const { from, to } = useSelector((s) => s.date);
  const store = useSelector((state) => state.stores.stores.find((item) => item._id === storeId));
  const [ads, setAds] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ads');
  const [filterTier, setFilterTier] = useState(null);
  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [frameworkOverview, setFrameworkOverview] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [savingReport, setSavingReport] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingMaster, setExportingMaster] = useState(false);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const [adsRes, campRes, frameworkRes, pipelineRes] = await Promise.all([
        api.get(`/api/stores/${storeId}/creativos`, { params }),
        api.get(`/api/stores/${storeId}/creativos/campaigns`, { params }),
        api.get(`/api/stores/${storeId}/creativos/framework-overview`),
        api.get(`/api/stores/${storeId}/creativos/pipeline`, { params }),
      ]);
      setAds(adsRes.data);
      setCampaigns(campRes.data);
      setFrameworkOverview(frameworkRes.data);
      setPipeline(pipelineRes.data);
    } catch {
      setAds([]);
      setCampaigns([]);
      setFrameworkOverview(null);
      setPipeline(null);
    }
    setLoading(false);
  }, [storeId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const generateBrief = async () => {
    setBriefLoading(true);
    setActionMsg(null);
    try {
      const { data } = await api.post(`/api/stores/${storeId}/ai/workflows/creative-brief`, { from, to });
      setBrief(data);
    } catch {
      setBrief(null);
    }
    setBriefLoading(false);
  };

  const savePipelineReport = async () => {
    if (!pipeline) return;
    setSavingReport(true);
    setActionMsg(null);
    try {
      const contenido = buildPipelineMarkdown({ from, to, pipeline, frameworkOverview, brief });
      await api.post(`/api/stores/${storeId}/reports`, {
        titulo: `Pipeline creativo · ${new Date().toLocaleDateString('es-AR')}`,
        contenido,
        section: 'creativos',
        tipo: 'report',
        summary: `Escalar ${pipeline.summary?.escalar || 0} · Pausar ${pipeline.summary?.pausar || 0} · Testear ${pipeline.summary?.testear || 0}`,
        dateRange: {
          from: from || null,
          to: to || null,
        },
        snapshot: {
          pipeline,
          framework: frameworkOverview,
          brief,
        },
        generationMode: brief ? 'ai' : 'manual',
        confidence: brief?.confidence ?? null,
        qualityNote: brief ? 'Incluye brief AI y pipeline creativo del período.' : 'Reporte guardado desde pipeline creativo sin brief AI adjunto.',
      });
      setActionMsg({ ok: true, text: 'Pipeline guardado en Reportes.' });
    } catch (error) {
      setActionMsg({ ok: false, text: error.response?.data?.error || 'No se pudo guardar el pipeline.' });
    }
    setSavingReport(false);
  };

  const exportPipelineCsv = () => {
    if (!pipeline) return;
    setExportingCsv(true);
    setActionMsg(null);
    try {
      const csv = buildPipelineCsv(pipeline);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pipeline-creativo-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      setActionMsg({ ok: true, text: 'CSV exportado. Lo podés abrir directamente en Sheets.' });
    } catch {
      setActionMsg({ ok: false, text: 'No se pudo exportar el CSV.' });
    }
    setExportingCsv(false);
  };

  const exportMasterSheet = () => {
    if (!pipeline) return;
    setExportingMaster(true);
    setActionMsg(null);
    try {
      const masterSheet = buildMasterSheetData({ from, to, pipeline, frameworkOverview, brief });
      const blob = new Blob([JSON.stringify(masterSheet, null, 2)], { type: 'application/json;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${masterSheet.documentName}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      setActionMsg({ ok: true, text: 'Documento maestro exportado. Queda listo como base única para Google Sheets.' });
    } catch {
      setActionMsg({ ok: false, text: 'No se pudo exportar el documento maestro.' });
    }
    setExportingMaster(false);
  };

  const saveMasterSheetReport = async () => {
    if (!pipeline) return;
    setSavingReport(true);
    setActionMsg(null);
    try {
      const masterSheet = buildMasterSheetData({ from, to, pipeline, frameworkOverview, brief });
      await api.post(`/api/stores/${storeId}/reports`, {
        titulo: `Documento maestro creativo · ${new Date().toLocaleDateString('es-AR')}`,
        contenido: buildMasterSheetMarkdown(masterSheet),
        section: 'creativos',
        tipo: 'report',
        summary: `Pestañas ${masterSheet.tabs.length} · Pipeline ${masterSheet.tabs[0]?.rows?.length || 0} filas · Backlog ${masterSheet.tabs[2]?.rows?.length || 0} filas`,
        dateRange: {
          from: from || null,
          to: to || null,
        },
        snapshot: {
          masterSheet,
          pipeline,
          framework: frameworkOverview,
          brief,
        },
        generationMode: brief ? 'ai' : 'manual',
        confidence: brief?.confidence ?? null,
        qualityNote: 'Template maestro para un único Google Sheet con pestañas operativas e históricas.',
      });
      setActionMsg({ ok: true, text: 'Documento maestro guardado en Reportes.' });
    } catch (error) {
      setActionMsg({ ok: false, text: error.response?.data?.error || 'No se pudo guardar el documento maestro.' });
    }
    setSavingReport(false);
  };

  const syncMasterSheetToGoogle = async () => {
    if (!pipeline) return;
    setSyncingSheets(true);
    setActionMsg(null);
    try {
      const { data } = await api.post(`/api/stores/${storeId}/creativos/master-sheet/sync`, {
        from: from || null,
        to: to || null,
        brief: brief || null,
      });
      setActionMsg({
        ok: true,
        text: `Documento maestro sincronizado en Google Sheets (${data.syncResult?.tabs?.length || 0} pestañas).`,
      });
    } catch (error) {
      setActionMsg({
        ok: false,
        text: error.response?.data?.error || 'No se pudo sincronizar el documento maestro con Google Sheets.',
      });
    }
    setSyncingSheets(false);
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-600 text-[13px]">Cargando creativos...</div>;
  }

  const filteredAds = filterTier ? ads.filter((a) => a.tier === filterTier) : ads;
  const tierCounts = {};
  for (const a of ads) {
    tierCounts[a.tier] = (tierCounts[a.tier] || 0) + 1;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Creativos</h1>
        <p className="page-subtitle">Clasificación ABCDE y resultados por campaña.</p>
      </div>

      <ClaudeActionBar
        storeId={storeId}
        storeName={store?.nombre}
        from={from}
        to={to}
        mode="creativos"
      />

      <div className="flex items-center gap-3">
        <button onClick={generateBrief} disabled={briefLoading} className="btn-primary disabled:opacity-50">
          {briefLoading ? 'Generando brief...' : 'Generar brief AI'}
        </button>
        <button onClick={savePipelineReport} disabled={savingReport || !pipeline} className="btn-secondary disabled:opacity-50">
          {savingReport ? 'Guardando...' : 'Guardar pipeline'}
        </button>
        <button onClick={exportPipelineCsv} disabled={exportingCsv || !pipeline} className="btn-secondary disabled:opacity-50">
          {exportingCsv ? 'Exportando...' : 'Exportar CSV'}
        </button>
        <button onClick={saveMasterSheetReport} disabled={savingReport || !pipeline} className="btn-secondary disabled:opacity-50">
          {savingReport ? 'Guardando...' : 'Guardar maestro'}
        </button>
        <button onClick={exportMasterSheet} disabled={exportingMaster || !pipeline} className="btn-secondary disabled:opacity-50">
          {exportingMaster ? 'Exportando...' : 'Exportar maestro'}
        </button>
        <button onClick={syncMasterSheetToGoogle} disabled={syncingSheets || !pipeline} className="btn-primary disabled:opacity-50">
          {syncingSheets ? 'Sincronizando...' : 'Sync a Sheets'}
        </button>
        {brief?.confidence != null && (
          <span className="text-[12px] text-app-secondary">Confianza {(brief.confidence * 100).toFixed(0)}%</span>
        )}
      </div>

      {actionMsg && (
        <p className={`text-[12px] ${actionMsg.ok ? 'text-emerald-300' : 'text-red-300'}`}>
          {actionMsg.text}
        </p>
      )}

      {brief?.ideas?.length > 0 && (
        <div className="card p-5">
          <div className="mb-4">
            <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Brief creativo</p>
            <h2 className="text-white text-lg font-semibold mt-1">{brief.title || 'Ideas priorizadas'}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {brief.ideas.map((idea, index) => (
              <div key={`${idea.hook}-${index}`} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-white text-[13px] font-semibold">{idea.hook}</p>
                  <span className="badge-blue">{idea.priority || 'medium'}</span>
                </div>
                <p className="text-app-secondary text-[12px]"><strong>Angulo:</strong> {idea.angle}</p>
                <p className="text-app-secondary text-[12px] mt-1"><strong>Formato:</strong> {idea.format}</p>
                <p className="text-app-primary text-[12px] mt-2">{idea.why}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {frameworkOverview && (
        <div className="card p-5 space-y-4">
          <div>
            <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Framework</p>
            <h2 className="text-white text-lg font-semibold mt-1">Cobertura estratégica creativa</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              ['Topics', frameworkOverview.summary?.topics || 0],
              ['Activos', frameworkOverview.summary?.activeTopics || 0],
              ['Hooks', frameworkOverview.summary?.hooks || 0],
              ['Objeciones', frameworkOverview.summary?.objections || 0],
              ['Sin respuesta', frameworkOverview.summary?.unresolvedObjections || 0],
              ['Competidores', frameworkOverview.summary?.competitors || 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">{label}</p>
                <p className="text-white text-xl font-semibold mt-1">{value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-app-muted text-[10px] uppercase tracking-[0.16em] mb-2">Territorios</p>
              <div className="space-y-2">
                {(frameworkOverview.territoryBreakdown || []).slice(0, 6).map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-[12px]">
                    <span className="text-app-secondary">{item.label}</span>
                    <span className="text-white font-semibold">{item.count}</span>
                  </div>
                ))}
                {(!frameworkOverview.territoryBreakdown || frameworkOverview.territoryBreakdown.length === 0) && (
                  <p className="text-app-secondary text-[12px]">Todavía no hay territorios catalogados.</p>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-app-muted text-[10px] uppercase tracking-[0.16em] mb-2">Avatares</p>
              <div className="space-y-2">
                {(frameworkOverview.avatarBreakdown || []).slice(0, 6).map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-[12px]">
                    <span className="text-app-secondary">{item.label}</span>
                    <span className="text-white font-semibold">{item.count}</span>
                  </div>
                ))}
                {(!frameworkOverview.avatarBreakdown || frameworkOverview.avatarBreakdown.length === 0) && (
                  <p className="text-app-secondary text-[12px]">Todavía no hay avatares cargados.</p>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-app-muted text-[10px] uppercase tracking-[0.16em] mb-2">Gaps</p>
              <div className="space-y-2 text-[12px]">
                <p className="text-app-secondary">
                  <strong className="text-white">{frameworkOverview.strategicGaps?.missingResponses?.length || 0}</strong> objeciones sin respuesta
                </p>
                <p className="text-app-secondary">
                  <strong className="text-white">{frameworkOverview.strategicGaps?.competitorAngles?.length || 0}</strong> ángulos detectados en competencia y no propios
                </p>
                <p className="text-app-secondary">
                  <strong className="text-white">{frameworkOverview.strategicGaps?.competitorTerritories?.length || 0}</strong> territorios abiertos por explorar
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {pipeline && (
        <div className="card p-5 space-y-4">
          <div>
            <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Pipeline creativo</p>
            <h2 className="text-white text-lg font-semibold mt-1">Qué escalar, pausar y testear</h2>
          </div>
          <CreativeHealthStrip ads={ads} pipeline={pipeline} frameworkOverview={frameworkOverview} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Ads con spend', pipeline.summary?.adsConSpend || 0],
              ['Escalar', pipeline.summary?.escalar || 0],
              ['Pausar', pipeline.summary?.pausar || 0],
              ['Testear', pipeline.summary?.testear || 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">{label}</p>
                <p className="text-white text-xl font-semibold mt-1">{value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
              <p className="text-emerald-300 text-[10px] uppercase tracking-[0.16em] mb-2">Escalar</p>
              <div className="space-y-2">
                {(pipeline.escalar || []).slice(0, 5).map((item, index) => (
                  <div key={`${item.title}-${index}`} className="text-[12px]">
                    <p className="text-white font-medium">{item.title}</p>
                    <p className="text-app-secondary mt-1">{item.reason}</p>
                  </div>
                ))}
                {(!pipeline.escalar || pipeline.escalar.length === 0) && (
                  <p className="text-app-secondary text-[12px]">No hay candidatos claros para escalar en este rango.</p>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4">
              <p className="text-red-300 text-[10px] uppercase tracking-[0.16em] mb-2">Pausar / revisar</p>
              <div className="space-y-2">
                {(pipeline.pausar || []).slice(0, 5).map((item, index) => (
                  <div key={`${item.title}-${index}`} className="text-[12px]">
                    <p className="text-white font-medium">{item.title}</p>
                    <p className="text-app-secondary mt-1">{item.reason}</p>
                  </div>
                ))}
                {(!pipeline.pausar || pipeline.pausar.length === 0) && (
                  <p className="text-app-secondary text-[12px]">No hay piezas críticas para pausar en este rango.</p>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-4">
              <p className="text-blue-300 text-[10px] uppercase tracking-[0.16em] mb-2">Testear después</p>
              <div className="space-y-2">
                {(pipeline.testear || []).slice(0, 5).map((item, index) => (
                  <div key={`${item.title}-${index}`} className="text-[12px]">
                    <p className="text-white font-medium">{item.title}</p>
                    <p className="text-app-secondary mt-1">{item.reason}</p>
                  </div>
                ))}
                {(!pipeline.testear || pipeline.testear.length === 0) && (
                  <p className="text-app-secondary text-[12px]">
                    No hay backlog estratégico pendiente detectado. Si esperabas ideas acá, probablemente falte cargar más framework creativo o abrir gaps nuevos.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {pipeline && (
        <div className="card p-5 space-y-4">
          <div>
            <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Documento maestro</p>
            <h2 className="text-white text-lg font-semibold mt-1">Un solo Google Sheet, varias pestañas</h2>
            <p className="text-app-secondary text-[12px] mt-2">
              La idea es mantener un único documento con pestañas estables. Algunas se pisan en cada actualización y otras acumulan histórico.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {buildMasterSheetData({ from, to, pipeline, frameworkOverview, brief }).tabs.map((tab) => (
              <div key={tab.name} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-white text-[13px] font-semibold">{tab.name}</p>
                  <span className={tab.mode === 'overwrite' ? 'badge-blue' : 'badge-amber'}>
                    {tab.mode === 'overwrite' ? 'Se pisa' : 'Se acumula'}
                  </span>
                </div>
                <p className="text-app-secondary text-[12px] mt-2">{tab.description}</p>
                <p className="text-app-muted text-[10px] uppercase tracking-[0.16em] mt-3">Columnas</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tab.columns.slice(0, 6).map((column) => (
                    <span key={column} className="badge-gray">{column}</span>
                  ))}
                  {tab.columns.length > 6 && (
                    <span className="badge-gray">+{tab.columns.length - 6}</span>
                  )}
                </div>
                <p className="text-app-secondary text-[12px] mt-3">
                  {tab.rows?.length || 0} filas listas para exportar
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/[0.06] pb-0">
        {[
          { id: 'ads', label: `Clasificación ABCDE (${ads.length})` },
          { id: 'campaigns', label: 'Resultados por campaña' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition ${
              tab === t.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ads' ? (
        <>
          {/* Tier filters */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setFilterTier(null)}
              className={!filterTier ? 'chip-active' : 'chip'}
            >
              Todos ({ads.length})
            </button>
            {['A', 'B', 'C', 'D', 'E'].map((t) => (
              <button
                key={t}
                onClick={() => setFilterTier(filterTier === t ? null : t)}
                className={filterTier === t ? 'chip-active' : 'chip'}
              >
                Tier {t} ({tierCounts[t] || 0})
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredAds.map((ad) => (
              <AdCard key={ad._id} ad={ad} />
            ))}
          </div>
          {filteredAds.length === 0 && (
            <p className="text-gray-600 text-[13px] text-center py-10">No hay ads para mostrar.</p>
          )}
        </>
      ) : (
        <div className="card">
          <CampaignResultsTable campaigns={campaigns} />
        </div>
      )}

      <AIAnalysisPanel storeId={storeId} section="creativos" from={from} to={to} />
    </div>
  );
}
