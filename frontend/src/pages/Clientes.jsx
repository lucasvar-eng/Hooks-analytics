import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import SortableLayout from '../components/common/SortableLayout';
import ClientesMetricsRow from '../components/clientes/ClientesMetricsRow';
import SegmentMap from '../components/clientes/SegmentMap';
import ClientesTable from '../components/clientes/ClientesTable';
import ActionCards from '../components/clientes/ActionCards';
import ParetoCard from '../components/clientes/ParetoCard';
import CohortHeatmap from '../components/clientes/CohortHeatmap';
import PeriodInsightsPanel from '../components/clientes/PeriodInsightsPanel';
import GlossaryModal from '../components/clientes/GlossaryModal';
import CustomerProfileModal from '../components/clientes/CustomerProfileModal';
import { CLIENTES_METRICS, CLIENTES_DEFAULTS, CLIENTES_MAX_SELECTED } from '../components/clientes/clientesMetricsCatalog';

/**
 * Página Clientes — rediseño operativo (2026-05-13).
 *
 * Bloques (todos reordenables vía SortableLayout):
 *  - kpis: 4 KPIs configurables de un catálogo de 10
 *  - segmap: mapa de segmentos RFM (barra apilada + 8 cards)
 *  - table: tabla con filtros chip por segmento, sort, búsqueda, paginación cliente
 *  - actions: ActionCards (En riesgo recuperar · Mejores premiar)
 *  - pareto: concentración de facturación (regla 80/20)
 *  - cohorts: heatmap de retención por mes de alta
 *  - quality: 3 quality checks
 *
 * El estado `selectedSegment` se comparte entre SegmentMap (mapa) y ClientesTable
 * (chips). Click en cualquiera filtra el otro.
 */
function fmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('es-AR');
}

export default function Clientes() {
  const { storeId } = useParams();
  const [customers, setCustomers] = useState([]);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [segments, setSegments] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [quality, setQuality] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [profileCustomer, setProfileCustomer] = useState(null);
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [custRes, segRes, cohortRes] = await Promise.all([
        api.get(`/api/stores/${storeId}/customers`, { params: { limit: 5000 } }),
        api.get(`/api/stores/${storeId}/customers/segments`),
        api.get(`/api/stores/${storeId}/customers/cohorts`),
      ]);
      setCustomers(custRes.data?.customers || []);
      setTotalCustomers(custRes.data?.total || 0);
      setSegments(segRes.data || []);
      setCohorts(cohortRes.data || []);
      // Quality es opcional — si falla no rompe el resto
      api.get(`/api/stores/${storeId}/customers/quality`)
        .then(({ data }) => setQuality(data))
        .catch(() => {});
    } catch (err) {
      console.error('Error cargando clientes:', err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return <div className="text-center py-12 text-[13px] text-gray-300">Cargando clientes...</div>;
  }

  const handleCustomerClick = (c) => setProfileCustomer(c);

  const data = {
    customers,
    segments,
    total: totalCustomers,
  };

  const blocks = [
    {
      id: 'kpis',
      label: 'Indicadores',
      node: (
        <ClientesMetricsRow
          title="Indicadores"
          subtitle={`Análisis de ${fmtNum(totalCustomers)} clientes — tocá cualquier ícono ⓘ para ver la definición`}
          data={data}
          availableMetrics={CLIENTES_METRICS}
          defaultSelected={CLIENTES_DEFAULTS}
          maxSelected={CLIENTES_MAX_SELECTED}
          storageKey={`hooks-clientes-metrics-${storeId}`}
          onOpenGlossary={() => setGlossaryOpen(true)}
        />
      ),
    },
    {
      id: 'period-insights',
      label: 'Insights del período',
      node: <PeriodInsightsPanel />,
    },
    {
      id: 'segmap',
      label: 'Mapa de segmentos',
      node: (
        <SegmentMap
          segments={segments}
          selected={selectedSegment}
          onSegmentSelect={setSelectedSegment}
          totalCustomers={totalCustomers}
        />
      ),
    },
    {
      id: 'table',
      label: 'Lista de clientes',
      node: (
        <ClientesTable
          customers={customers}
          selectedSegment={selectedSegment}
          onSegmentSelect={setSelectedSegment}
          onRowClick={handleCustomerClick}
        />
      ),
    },
    {
      id: 'actions',
      label: 'Acciones recomendadas',
      node: (
        <ActionCards customers={customers} onCustomerClick={handleCustomerClick} />
      ),
    },
    {
      id: 'pareto',
      label: 'Concentración de facturación',
      node: <ParetoCard customers={customers} segments={segments} />,
    },
    {
      id: 'cohorts',
      label: 'Cohortes de retención',
      node: <CohortHeatmap cohorts={cohorts} />,
    },
    {
      id: 'quality',
      label: 'Calidad de datos',
      node: <QualityCards quality={quality} />,
    },
  ];

  return (
    <div className="space-y-5">
      <SortableLayout
        items={blocks}
        storageKey={`hooks-clientes-layout-${storeId}`}
        defaultOrder={blocks.map((b) => b.id)}
      />

      <CustomerProfileModal customer={profileCustomer} onClose={() => setProfileCustomer(null)} />
      <GlossaryModal open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
    </div>
  );
}

function QualityCards({ quality }) {
  if (!quality) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div className="card p-4">
        <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Clientes sin email real</p>
        <p className={`text-[22px] font-bold mt-1.5 leading-none ${(quality.customersWithoutRealEmail || 0) === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
          {fmtNum(quality.customersWithoutRealEmail || 0)}
        </p>
        <p className="text-[11px] text-gray-300 mt-1.5">
          {(quality.customersWithoutRealEmail || 0) === 0 ? 'Todos los clientes son contactables' : 'Sin email recuperable — no podés contactarlos'}
        </p>
      </div>
      <div className="card p-4">
        <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Órdenes sin cliente</p>
        <p className={`text-[22px] font-bold mt-1.5 leading-none ${(quality.ordersWithoutCustomer || 0) === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
          {fmtNum(quality.ordersWithoutCustomer || 0)}
        </p>
        <p className="text-[11px] text-gray-300 mt-1.5">
          {(quality.ordersWithoutCustomer || 0) === 0 ? 'Todas las órdenes están atribuidas' : 'Órdenes sin email ni ID de cliente'}
        </p>
      </div>
      <div className="card p-4">
        <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300">Cohortes con poca muestra</p>
        <p className={`text-[22px] font-bold mt-1.5 leading-none ${(quality.sparseCohorts?.length || 0) === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
          {fmtNum(quality.sparseCohorts?.length || 0)}
        </p>
        <p className="text-[11px] text-gray-300 mt-1.5">
          {(quality.sparseCohorts?.length || 0) === 0
            ? 'Todas las cohortes tienen muestra suficiente'
            : `${quality.sparseCohorts.join(', ')} con menos de 3 clientes`}
        </p>
      </div>
    </div>
  );
}
