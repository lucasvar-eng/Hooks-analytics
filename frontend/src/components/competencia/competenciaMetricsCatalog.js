/**
 * Catálogo de métricas del header "Indicadores" en la página Competencia.
 * Hasta 4 visibles, selección persistida en localStorage por tienda.
 *
 * data shape: { competitors, overview }
 *   - competitors: array de Competitor del backend
 *   - overview: { summary, gaps, ... } del endpoint /overview
 */

function fmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('es-AR');
}
function fmtPct(v, digits = 0) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(digits).replace('.', ',')}%`;
}

function daysSince(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

function countOpportunities(competitors) {
  return (competitors || []).reduce((acc, c) => {
    if (!c.analysisResult) return acc;
    // Las oportunidades viven en `analysisResult` markdown o `objectionsDetected`.
    // Como heurística: cada bullet con "•" o "-" inicial cuenta. Si no hay, 0.
    const text = c.analysisResult || '';
    const bullets = text.match(/^[\s]*[-•*]\s+/gm);
    return acc + (bullets ? bullets.length : 0);
  }, 0);
}

function lastAnalysisDate(competitors) {
  const dates = (competitors || [])
    .map((c) => (c.lastAnalysis ? new Date(c.lastAnalysis).getTime() : null))
    .filter((d) => d != null);
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates));
}

function lastAnalyzedCompetitor(competitors) {
  let best = null;
  for (const c of competitors || []) {
    if (!c.lastAnalysis) continue;
    if (!best || new Date(c.lastAnalysis) > new Date(best.lastAnalysis)) best = c;
  }
  return best;
}

export const COMPETENCIA_METRICS = [
  {
    key: 'total',
    defaultLabel: 'Competidores cargados',
    info: 'Total de competidores registrados',
    getValue: (d) => fmtNum(d?.overview?.summary?.total || (d?.competitors?.length || 0)),
    getSub: (d) => {
      const total = d?.overview?.summary?.total || (d?.competitors?.length || 0);
      const withUrl = d?.overview?.summary?.withUrl || 0;
      const noUrl = total - withUrl;
      if (!total) return 'Sin competidores cargados';
      return `${fmtNum(withUrl)} con URL · ${fmtNum(noUrl)} sin URL`;
    },
  },
  {
    key: 'analyzed',
    defaultLabel: 'Analizados con AI',
    info: 'Competidores con análisis automático generado',
    getValue: (d) => fmtNum(d?.overview?.summary?.analyzed || 0),
    getSub: (d) => {
      const total = d?.overview?.summary?.total || 0;
      const analyzed = d?.overview?.summary?.analyzed || 0;
      const pending = d?.overview?.summary?.pendingAnalysis || 0;
      if (!total) return 'Sin competidores';
      return `${fmtPct((analyzed / total) * 100, 0)} · ${fmtNum(pending)} sin analizar`;
    },
    getTone: (d) => {
      const total = d?.overview?.summary?.total || 0;
      const analyzed = d?.overview?.summary?.analyzed || 0;
      if (!total) return null;
      const pct = (analyzed / total) * 100;
      if (pct >= 80) return 'good';
      if (pct >= 50) return null;
      return 'warn';
    },
  },
  {
    key: 'opportunities',
    defaultLabel: 'Oportunidades pendientes',
    info: 'Acciones sugeridas por el análisis AI que aún no implementaste',
    getValue: (d) => fmtNum(countOpportunities(d?.competitors)),
    getSub: (d) => {
      const withAnalysis = (d?.competitors || []).filter((c) => c.analysisResult).length;
      if (!withAnalysis) return 'Aún no hay análisis disponibles';
      return `Distribuidas en ${fmtNum(withAnalysis)} competidores`;
    },
    getTone: (d) => (countOpportunities(d?.competitors) > 0 ? 'warn' : null),
  },
  {
    key: 'lastAnalysis',
    defaultLabel: 'Último análisis',
    info: 'Días desde el análisis más reciente — refrescá si pasó más de 30 días',
    getValue: (d) => {
      const date = lastAnalysisDate(d?.competitors);
      if (!date) return '—';
      const days = daysSince(date);
      if (days === 0) return 'Hoy';
      return `${days}d`;
    },
    getSub: (d) => {
      const last = lastAnalyzedCompetitor(d?.competitors);
      if (!last) return 'Sin análisis previos';
      const date = new Date(last.lastAnalysis);
      return `${last.nombre} · ${date.toLocaleDateString('es-AR')}`;
    },
  },
  {
    key: 'uniqueAngles',
    defaultLabel: 'Ángulos únicos',
    info: 'Cantidad de ángulos distintos detectados entre todos los competidores',
    getValue: (d) => fmtNum(d?.overview?.summary?.uniqueAngles || 0),
    getSub: (d) => `${fmtNum(d?.overview?.summary?.missingAngles || 0)} competidores sin ángulos cargados`,
  },
  {
    key: 'uniqueTerritories',
    defaultLabel: 'Territorios únicos',
    info: 'Cantidad de territorios distintos detectados entre todos los competidores',
    getValue: (d) => fmtNum(d?.overview?.summary?.uniqueTerritories || 0),
    getSub: (d) => `${fmtNum(d?.overview?.summary?.missingTerritories || 0)} competidores sin territorios cargados`,
  },
  {
    key: 'objections',
    defaultLabel: 'Objeciones detectadas',
    info: 'Total de objeciones identificadas en el análisis competitivo',
    getValue: (d) => {
      const total = (d?.competitors || []).reduce(
        (acc, c) => acc + (c.objectionsDetected?.length || 0),
        0,
      );
      return fmtNum(total);
    },
    getSub: (d) => `${fmtNum(d?.overview?.summary?.missingObjections || 0)} sin objeciones cargadas`,
  },
  {
    key: 'withUrl',
    defaultLabel: 'Con URL',
    info: 'Competidores con URL cargada (necesario para analizar con AI)',
    getValue: (d) => fmtNum(d?.overview?.summary?.withUrl || 0),
    getSub: (d) => {
      const total = d?.overview?.summary?.total || 0;
      const withUrl = d?.overview?.summary?.withUrl || 0;
      if (!total) return '—';
      return `${fmtPct((withUrl / total) * 100, 0)} del total`;
    },
  },
];

export const COMPETENCIA_DEFAULTS = ['total', 'analyzed', 'opportunities', 'lastAnalysis'];
export const COMPETENCIA_MAX_SELECTED = 4;
