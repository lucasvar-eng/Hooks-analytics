import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import SortableLayout from '../components/common/SortableLayout';
import CompetenciaMetricsRow from '../components/competencia/CompetenciaMetricsRow';
import CompetidorCard from '../components/competencia/CompetidorCard';
import ActionCardsCompetencia from '../components/competencia/ActionCardsCompetencia';
import AddCompetidorModal from '../components/competencia/AddCompetidorModal';
import CompetidorDetailModal from '../components/competencia/CompetidorDetailModal';
import CompetidorCompareModal from '../components/competencia/CompetidorCompareModal';
import CompetidorScrapeModal from '../components/competencia/CompetidorScrapeModal';
import GlossaryModalCompetencia from '../components/competencia/GlossaryModalCompetencia';
import {
  COMPETENCIA_METRICS,
  COMPETENCIA_DEFAULTS,
  COMPETENCIA_MAX_SELECTED,
} from '../components/competencia/competenciaMetricsCatalog';

/**
 * Página Competencia — rediseño operativo (2026-05-13).
 *
 * Bloques (reordenables vía SortableLayout):
 *  - kpis: 4 KPIs configurables de 8
 *  - filters: chips por estado + búsqueda + topbar con CTA "+ Agregar"
 *  - grid: cards grandes 2 cols, una por competidor
 *  - actions: ActionCards (Sin análisis · Oportunidades hot)
 *
 * Modales:
 *  - Add/Edit competidor (form simplificado, avanzado opt-in)
 *  - Detalle (markdown análisis + datos + oportunidades focalizadas)
 *  - Comparar (2-3 lado a lado)
 *  - Glosario
 */

function fmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('es-AR');
}

const STATUS_FILTERS = [
  { id: 'all', label: 'Todos', match: () => true },
  { id: 'analyzed', label: 'Analizados', match: (c) => !!c.analysisResult },
  { id: 'pending', label: 'Pendientes', match: (c) => !!c.url && !c.analysisResult },
  { id: 'no_url', label: 'Sin URL', match: (c) => !c.url },
  { id: 'with_opps', label: 'Con oportunidades', match: (c) => !!c.analysisResult && /[-•*]\s+/m.test(c.analysisResult || '') },
];

export default function Competencia() {
  const { storeId } = useParams();
  const [competitors, setCompetitors] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  const [filterId, setFilterId] = useState('all');
  const [search, setSearch] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailCompetitor, setDetailCompetitor] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [scrapingId, setScrapingId] = useState(null);
  const [scrapeState, setScrapeState] = useState({ open: false, competitor: null, loading: false, error: null, data: null });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [list, ov] = await Promise.all([
        api.get(`/api/stores/${storeId}/competitors`),
        api.get(`/api/stores/${storeId}/competitors/overview`),
      ]);
      setCompetitors(list.data || []);
      setOverview(ov.data || null);
    } catch (err) {
      console.error('Error cargando competidores:', err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filterCounts = useMemo(() => {
    const counts = {};
    STATUS_FILTERS.forEach((f) => { counts[f.id] = competitors.filter(f.match).length; });
    return counts;
  }, [competitors]);

  const filtered = useMemo(() => {
    const f = STATUS_FILTERS.find((x) => x.id === filterId) || STATUS_FILTERS[0];
    const q = search.trim().toLowerCase();
    return competitors.filter((c) => {
      if (!f.match(c)) return false;
      if (!q) return true;
      const name = (c.nombre || '').toLowerCase();
      const url = (c.url || '').toLowerCase();
      const angles = (c.angles || []).join(' ').toLowerCase();
      const offer = (c.mainOffer || '').toLowerCase();
      return name.includes(q) || url.includes(q) || angles.includes(q) || offer.includes(q);
    });
  }, [competitors, filterId, search]);

  const compareList = useMemo(() => {
    return compareIds.map((id) => competitors.find((c) => c._id === id)).filter(Boolean);
  }, [compareIds, competitors]);

  const handleSubmit = async (payload) => {
    try {
      if (editing) {
        await api.put(`/api/stores/${storeId}/competitors/${editing._id}`, payload);
      } else {
        await api.post(`/api/stores/${storeId}/competitors`, payload);
      }
      setAddOpen(false);
      setEditing(null);
      await fetchAll();
    } catch (err) {
      console.error('Error guardando competidor:', err);
    }
  };

  const handleAnalyze = async (c) => {
    setAnalyzingId(c._id);
    try {
      await api.post(`/api/stores/${storeId}/competitors/${c._id}/analyze`);
      await fetchAll();
    } catch (err) {
      console.error('Error analizando:', err);
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleScrape = async (c) => {
    setScrapingId(c._id);
    setScrapeState({ open: true, competitor: c, loading: true, error: null, data: null });
    try {
      const { data } = await api.post(`/api/stores/${storeId}/competitors/${c._id}/scrape`);
      setScrapeState((s) => ({ ...s, loading: false, data }));
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Error desconocido al scrapear el sitio.';
      setScrapeState((s) => ({ ...s, loading: false, error: message }));
    } finally {
      setScrapingId(null);
    }
  };

  const handleApplyScrape = async ({ updates, force }) => {
    if (!scrapeState.competitor) return;
    const qs = force ? '?force=true' : '';
    try {
      await api.post(
        `/api/stores/${storeId}/competitors/${scrapeState.competitor._id}/scrape/apply${qs}`,
        updates,
      );
      setScrapeState({ open: false, competitor: null, loading: false, error: null, data: null });
      await fetchAll();
    } catch (err) {
      console.error('Error aplicando sugerencias:', err);
    }
  };

  const closeScrape = () => {
    setScrapeState({ open: false, competitor: null, loading: false, error: null, data: null });
  };

  const handleOpportunities = async (c) => {
    try {
      const { data } = await api.post(`/api/stores/${storeId}/competitors/${c._id}/opportunities`);
      return data;
    } catch (err) {
      console.error('Error generando oportunidades:', err);
      return null;
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`¿Eliminar "${c.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/api/stores/${storeId}/competitors/${c._id}`);
      setDetailCompetitor(null);
      setCompareIds((ids) => ids.filter((id) => id !== c._id));
      await fetchAll();
    } catch (err) {
      console.error('Error eliminando:', err);
    }
  };

  const handleEdit = (c) => {
    setEditing(c);
    setDetailCompetitor(null);
    setAddOpen(true);
  };

  const toggleCompare = (c) => {
    setCompareIds((prev) => {
      if (prev.includes(c._id)) return prev.filter((id) => id !== c._id);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, c._id];
    });
  };

  const removeFromCompare = (c) => {
    setCompareIds((prev) => prev.filter((id) => id !== c._id));
  };

  const openDetail = (c) => {
    setDetailCompetitor(c);
  };

  const closeAdd = () => {
    setAddOpen(false);
    setEditing(null);
  };

  if (loading) {
    return <div className="text-center py-12 text-[13px] text-gray-300">Cargando competencia...</div>;
  }

  const data = { competitors, overview };

  const blocks = [
    {
      id: 'kpis',
      label: 'Indicadores',
      node: (
        <CompetenciaMetricsRow
          title="Indicadores"
          subtitle={`Análisis de ${fmtNum(competitors.length)} competidor${competitors.length === 1 ? '' : 'es'} cargado${competitors.length === 1 ? '' : 's'}`}
          data={data}
          availableMetrics={COMPETENCIA_METRICS}
          defaultSelected={COMPETENCIA_DEFAULTS}
          maxSelected={COMPETENCIA_MAX_SELECTED}
          storageKey={`hooks-competencia-metrics-${storeId}`}
          onOpenGlossary={() => setGlossaryOpen(true)}
        />
      ),
    },
    {
      id: 'filters',
      label: 'Filtros',
      node: (
        <FiltersBar
          filterId={filterId}
          onFilterChange={setFilterId}
          counts={filterCounts}
          search={search}
          onSearchChange={setSearch}
          compareCount={compareIds.length}
          onOpenCompare={() => setCompareOpen(true)}
          onAddCompetidor={() => { setEditing(null); setAddOpen(true); }}
        />
      ),
    },
    {
      id: 'grid',
      label: 'Competidores',
      node: (
        <CompetitorsGrid
          competitors={filtered}
          compareIds={compareIds}
          analyzingId={analyzingId}
          scrapingId={scrapingId}
          onToggleCompare={toggleCompare}
          onAnalyze={handleAnalyze}
          onScrape={handleScrape}
          onEdit={handleEdit}
          onOpenDetail={openDetail}
          onAddCompetidor={() => { setEditing(null); setAddOpen(true); }}
          totalCount={competitors.length}
        />
      ),
    },
    {
      id: 'actions',
      label: 'Acciones recomendadas',
      node: (
        <ActionCardsCompetencia
          competitors={competitors}
          onAnalyze={handleAnalyze}
          onEdit={handleEdit}
          onOpenDetail={openDetail}
          analyzingId={analyzingId}
        />
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <SortableLayout
        items={blocks}
        storageKey={`hooks-competencia-layout-${storeId}`}
        defaultOrder={blocks.map((b) => b.id)}
      />

      <AddCompetidorModal
        open={addOpen}
        competitor={editing}
        onClose={closeAdd}
        onSubmit={handleSubmit}
      />

      <CompetidorDetailModal
        competitor={detailCompetitor}
        storeId={storeId}
        onClose={() => setDetailCompetitor(null)}
        onAnalyze={handleAnalyze}
        onOpportunities={handleOpportunities}
        onScrape={handleScrape}
        onEdit={handleEdit}
        onDelete={handleDelete}
        analyzing={analyzingId === detailCompetitor?._id}
        scraping={scrapingId === detailCompetitor?._id}
      />

      <CompetidorScrapeModal
        open={scrapeState.open}
        loading={scrapeState.loading}
        error={scrapeState.error}
        data={scrapeState.data}
        competitor={scrapeState.competitor}
        onClose={closeScrape}
        onApply={handleApplyScrape}
      />

      {compareOpen && (
        <CompetidorCompareModal
          competitors={compareList}
          onClose={() => setCompareOpen(false)}
          onRemove={removeFromCompare}
          onOpenDetail={(c) => { setCompareOpen(false); openDetail(c); }}
        />
      )}

      <GlossaryModalCompetencia open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
    </div>
  );
}

function FiltersBar({
  filterId,
  onFilterChange,
  counts,
  search,
  onSearchChange,
  compareCount,
  onOpenCompare,
  onAddCompetidor,
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onOpenCompare}
          disabled={compareCount < 2}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] hover:border-white/20 px-3 py-1.5 text-[11.5px] font-medium text-gray-200 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Comparar ({compareCount})
        </button>
        <button
          type="button"
          onClick={onAddCompetidor}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 px-4 py-1.5 text-[12px] font-semibold transition"
        >
          + Agregar competidor
        </button>
      </div>

      <div className="card p-0">
        <div className="flex flex-wrap gap-2.5 items-center px-5 py-4">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onFilterChange(f.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border transition
                ${filterId === f.id
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-200'
                  : 'bg-white/[0.04] border-white/[0.08] text-gray-200 hover:border-white/20 hover:text-white'}`}
            >
              {f.label}
              <span className={`rounded-full px-1.5 py-px text-[10px] font-bold
                ${filterId === f.id ? 'bg-blue-500/25 text-blue-100' : 'bg-white/[0.08] text-gray-200'}`}>
                {fmtNum(counts[f.id])}
              </span>
            </button>
          ))}
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre, URL u ángulo..."
            className="ml-auto bg-white/[0.04] border border-white/[0.08] rounded-full px-3 py-1.5 text-[12px] text-white placeholder:text-gray-400 outline-none focus:border-blue-500/40 min-w-[200px] max-w-[280px] flex-1"
          />
        </div>
      </div>
    </div>
  );
}

function CompetitorsGrid({
  competitors,
  compareIds,
  analyzingId,
  scrapingId,
  onToggleCompare,
  onAnalyze,
  onScrape,
  onEdit,
  onOpenDetail,
  onAddCompetidor,
  totalCount,
}) {
  if (totalCount === 0) {
    return (
      <div className="card py-14 px-6 text-center border-dashed border-white/[0.1]">
        <p className="text-[18px] font-bold text-white">No hay competidores cargados</p>
        <p className="text-[13px] text-gray-300 mt-2 max-w-[480px] mx-auto leading-relaxed">
          Agregá un competidor con su URL y la IA va a extraer su oferta, ángulos, posicionamiento y oportunidades automáticamente.
        </p>
        <button
          type="button"
          onClick={onAddCompetidor}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 px-5 py-2.5 text-[13px] font-semibold transition"
        >
          + Agregar primer competidor
        </button>
      </div>
    );
  }

  if (competitors.length === 0) {
    return (
      <div className="card py-12 text-center">
        <p className="text-[13px] text-gray-200">No hay competidores para este filtro o búsqueda.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {competitors.map((c) => (
        <CompetidorCard
          key={c._id}
          competitor={c}
          selectedForCompare={compareIds.includes(c._id)}
          onToggleCompare={onToggleCompare}
          onAnalyze={onAnalyze}
          onScrape={onScrape}
          onEdit={onEdit}
          onOpenDetail={onOpenDetail}
          analyzing={analyzingId === c._id}
          scraping={scrapingId === c._id}
        />
      ))}
    </div>
  );
}
