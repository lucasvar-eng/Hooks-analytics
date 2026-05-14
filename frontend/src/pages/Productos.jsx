import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import TopInsightBar from '../components/insights/TopInsightBar';
import ProductsTable from '../components/productos/ProductsTable';
import ProductsMetricsRow from '../components/productos/ProductsMetricsRow';
import { CapitalAtrapadoCard, RepongoCard } from '../components/productos/ActionCards';
import CatalogHealth from '../components/productos/CatalogHealth';
import CategoryTable from '../components/productos/CategoryTable';
import AgingChart from '../components/productos/AgingChart';
import ConcentrationChart from '../components/productos/ConcentrationChart';
import ProductMonthlyHeatmap from '../components/productos/ProductMonthlyHeatmap';
import ProductProfileModal from '../components/productos/ProductProfileModal';
import SortableLayout from '../components/common/SortableLayout';
import {
  PRODUCTOS_METRICS,
  PRODUCTOS_DEFAULTS,
  PRODUCTOS_MAX_SELECTED,
} from '../components/productos/productosMetricsCatalog';

/**
 * Página Productos rediseñada (2026-05-13).
 *
 * Vista global del catálogo: tabla con filtros + sort + scroll vertical es el bloque
 * principal. Resto es contexto: indicadores configurables, acciones recomendadas,
 * salud, comercial por categoría, aging, concentración.
 *
 * Estructura:
 *   1. TopInsightBar
 *   2. ProductsTable (tabla principal con filtros chip, sort, scroll, paginación)
 *   3. ProductsMetricsRow (4 KPIs configurables vía picker)
 *   4. CapitalAtrapadoCard + RepongoCard (2 cols)
 *   5. CatalogHealth (barra apilada compacta)
 *   6. CategoryTable
 *   7. AgingChart + ConcentrationChart (2 cols)
 *
 * Removido vs versión anterior:
 *   - h1 redundante "Productos"
 *   - Card "Conciliación con tienda" (vive en Costos)
 *   - Card "Cobertura de costos" (vive en Costos)
 *   - Grid 3 (Top sellers / Stock lento / Dead stock-bajo retorno) — la tabla con
 *     filtros cubre lo mismo de forma accionable
 *   - assortmentMatrix (Stars/Sleepers/Dead/LowReturn) — duplicaba la tabla con filtros
 *   - stockHealth (Sobrestock/Riesgo/Trampas/Promo) — duplicaba la tabla con filtros
 */
export default function Productos() {
  const { storeId } = useParams();
  const { from, to } = useSelector((s) => s.date);
  const coverage = useSelector((state) => state.stores.metrics[storeId]?.costCoverage || null);

  const [products, setProducts] = useState([]);
  const [overview, setOverview] = useState(null);
  const [commercial, setCommercial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      // Pedimos hasta 2000 productos: con 1.869 (Límite) entra una página. La tabla pagina/filtra/ordena en cliente.
      const [{ data: list }, { data: ov }, { data: com }] = await Promise.all([
        api.get(`/api/stores/${storeId}/products`, { params: { ...params, page: 1, limit: 2000 } }),
        api.get(`/api/stores/${storeId}/products/overview`, { params }),
        api.get(`/api/stores/${storeId}/products/commercial`, { params }),
      ]);
      setProducts(list?.products || []);
      setOverview(ov);
      setCommercial(com);
    } catch {
      setProducts([]);
      setOverview(null);
      setCommercial(null);
    }
    setLoading(false);
  }, [storeId, from, to]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Data derivada para el picker de métricas: combina overview + counts derivados de products.
  const metricsData = useMemo(() => {
    const soldCount = products.filter((p) => (p.periodSales || 0) > 0).length;
    const activeCount = products.filter((p) => p.activo).length;
    const inactiveCount = products.length - activeCount;

    // Capital atrapado: suma del valor de stock (unidades × precio o COGS) para dead stock.
    const trapped = products.reduce((acc, p) => {
      const isDead = (p.periodSales || 0) === 0 && (p.stock || 0) > 0;
      if (!isDead) return acc;
      const unitCost = p.costoUnitario || p.precio || 0;
      acc.value += (p.stock || 0) * unitCost;
      acc.count += 1;
      return acc;
    }, { value: 0, count: 0 });

    return {
      summary: overview?.summary || {},
      soldCount,
      activeCount,
      inactiveCount,
      capitalTrappedValue: trapped.value,
      capitalTrappedCount: trapped.count,
    };
  }, [products, overview]);

  // Detectar si la cobertura está distorsionada por período corto + bajo volumen
  const coverageHasIssue = useMemo(() => {
    if (!commercial?.categories) return false;
    return commercial.categories.some((c) => (c.coverageDays || 0) > 365);
  }, [commercial]);

  if (loading) {
    return <div className="text-center py-12 text-[13px] text-gray-300">Cargando productos...</div>;
  }

  const sortableItems = [
    {
      id: 'products-table',
      label: 'Tabla principal',
      node: <ProductsTable products={products} onRowClick={setSelectedProduct} />,
    },
    {
      id: 'metrics-row',
      label: 'Indicadores',
      node: (
        <ProductsMetricsRow
          title="Indicadores"
          subtitle="Lectura rápida del catálogo en el período seleccionado"
          data={metricsData}
          availableMetrics={PRODUCTOS_METRICS}
          defaultSelected={PRODUCTOS_DEFAULTS}
          maxSelected={PRODUCTOS_MAX_SELECTED}
          storageKey={`hooks-productos-${storeId}`}
          coverage={coverage}
          storeId={storeId}
        />
      ),
    },
    {
      id: 'action-cards',
      label: 'Acciones recomendadas',
      node: (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <CapitalAtrapadoCard products={products} onProductClick={setSelectedProduct} />
          <RepongoCard products={products} onProductClick={setSelectedProduct} />
        </div>
      ),
    },
    {
      id: 'catalog-health',
      label: 'Salud del catálogo',
      node: <CatalogHealth products={products} summary={overview?.summary} />,
    },
    {
      id: 'monthly-matrix',
      label: 'Producto × mes',
      node: <ProductMonthlyHeatmap />,
    },
    ...(commercial?.categories ? [{
      id: 'category-table',
      label: 'Comercial por categoría',
      node: <CategoryTable categories={commercial.categories} coverageHasIssue={coverageHasIssue} />,
    }] : []),
    ...(commercial?.agingSummary || commercial?.categoryConcentration ? [{
      id: 'aging-concentration',
      label: 'Aging + Concentración',
      node: (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {commercial?.agingSummary && (
            <AgingChart
              agingSummary={commercial.agingSummary}
              totalProducts={overview?.summary?.totalProducts}
            />
          )}
          {commercial?.categoryConcentration && (
            <ConcentrationChart items={commercial.categoryConcentration} />
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <div className="space-y-5">
      <TopInsightBar storeId={storeId} />

      <SortableLayout
        items={sortableItems}
        storageKey={`hooks-productos-layout-${storeId}`}
      />

      {selectedProduct && (
        <ProductProfileModal
          storeId={storeId}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
