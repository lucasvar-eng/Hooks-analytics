import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import MetricCompleteness from '../components/common/MetricCompleteness';

function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function EstadoBadge({ activo, estadoPublicacion }) {
  const label = estadoPublicacion === 'inactivo' ? 'Inactivo' : activo ? 'Activo' : 'Inactivo';
  const className = activo
    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/20'
    : 'bg-white/[0.06] text-app-secondary border border-white/[0.08]';
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}>{label}</span>;
}

function ProductProfileModal({ storeId, product, onClose }) {
  const [profile, setProfile] = useState(null);
  const [sim, setSim] = useState(null);
  const [simInputs, setSimInputs] = useState({
    precio: product.precio,
    costoUnitario: product.costoUnitario,
    costoEmpaque: product.costoEmpaque || 0,
  });

  useEffect(() => {
    api.get(`/api/stores/${storeId}/products/${product._id}/profile`).then((r) => setProfile(r.data)).catch(() => {});
  }, [storeId, product._id]);

  const handleSimulate = async () => {
    try {
      const { data } = await api.post(`/api/stores/${storeId}/products/${product._id}/simulate`, simInputs);
      setSim(data);
    } catch {}
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#161616] border border-white/[0.08] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-4 mb-5">
          {product.imagenUrl && (
            <img src={product.imagenUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />
          )}
          <div>
            <h3 className="text-[15px] font-bold text-white">{product.nombre}</h3>
            <p className="text-[11px] text-gray-600 mt-0.5">ID: {product.tnProductId} | SKU: {product.sku || '—'} | Stock: {product.stock}</p>
            <p className="text-[11px] text-gray-600 mt-0.5">
              {product.categoria || 'Sin categoría'}{product.subcategoria ? ` · ${product.subcategoria}` : ''}
            </p>
          </div>
        </div>

        {/* Cost breakdown */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          {[
            { label: 'Precio', value: fmt(product.precio), color: '' },
            { label: 'COGS', value: fmt(product.costoUnitario), color: '' },
            { label: 'Margen Bruto', value: `${fmt(product.margenBruto)} (${(product.margenBrutoPct || 0).toFixed(1)}%)`, color: (product.margenBrutoPct || 0) > 30 ? 'text-emerald-400' : 'text-amber-400' },
            { label: 'Ventas 30d', value: product.ventas30dias, color: '' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
              <p className="kpi-label">{label}</p>
              <p className={`text-[18px] font-bold mt-1 ${color || 'text-white'}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Simulator */}
        <div className="border-t border-white/[0.06] pt-4 mb-5">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Simulador</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Precio', key: 'precio' },
              { label: 'COGS', key: 'costoUnitario' },
              { label: 'Empaque', key: 'costoEmpaque' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="kpi-label">{label}</label>
                <input
                  type="number"
                  value={simInputs[key]}
                  onChange={(e) => setSimInputs({ ...simInputs, [key]: +e.target.value })}
                  className="input-dark mt-1 w-full"
                />
              </div>
            ))}
          </div>
          <button onClick={handleSimulate} className="btn-primary mt-3">Simular</button>
          {sim && (
            <p className="mt-2 text-[12px] text-gray-400">
              Margen: <span className={`font-bold ${sim.margenBrutoPct > 30 ? 'text-emerald-400' : 'text-amber-400'}`}>{fmt(sim.margenBruto)} ({sim.margenBrutoPct.toFixed(1)}%)</span>
            </p>
          )}
        </div>

        {/* Recent orders */}
        {profile?.recentOrders?.length > 0 && (
          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Últimas ventas</p>
            <table className="w-full table-dark">
              <thead>
                <tr>
                  <th className="text-left">Orden</th>
                  <th className="text-left">Cliente</th>
                  <th className="text-right">Cant.</th>
                  <th className="text-right">Ingreso neto</th>
                </tr>
              </thead>
              <tbody>
                {profile.recentOrders.map((o, i) => (
                  <tr key={i}>
                    <td>{o.tnOrderNumber}</td>
                    <td>{o.customerName}</td>
                    <td className="text-right">{o.cantidad}</td>
                    <td className="text-right tabular-nums">{fmt(o.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {product.productUrl && (
          <a href={product.productUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-[12px] text-app-primary hover:underline">
            Abrir producto en tienda
          </a>
        )}

        <button onClick={onClose} className="mt-5 w-full py-2 text-[12px] text-gray-600 hover:text-gray-400 transition">
          Cerrar
        </button>
      </div>
    </div>
  );
}

function StockBadge({ stock, ventas30dias, ultimaVenta }) {
  if (stock === 0) return <span className="badge-red ml-1.5">Sin stock</span>;
  if (stock <= 5) return <span className="badge-amber ml-1.5">Stock bajo</span>;
  if (ventas30dias === 0 && stock > 0) {
    const noSale = !ultimaVenta || (new Date() - new Date(ultimaVenta)) > 90 * 24 * 60 * 60 * 1000;
    if (noSale) return <span className="badge-gray ml-1.5">Dead stock</span>;
  }
  return null;
}

export default function Productos() {
  const { storeId } = useParams();
  const { from, to } = useSelector((s) => s.date);
  const store = useSelector((state) => state.stores.stores.find((item) => item._id === storeId));
  const coverage = useSelector((state) => state.stores.metrics[storeId]?.costCoverage || null);
  const [data, setData] = useState({ products: [], total: 0 });
  const [overview, setOverview] = useState(null);
  const [commercial, setCommercial] = useState(null);
  const [storeMetrics, setStoreMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (from) params.from = from;
      if (to) params.to = to;
      const [{ data: res }, { data: overviewRes }, { data: commercialRes }, { data: metricsRes }] = await Promise.all([
        api.get(`/api/stores/${storeId}/products`, { params }),
        api.get(`/api/stores/${storeId}/products/overview`, { params: { from, to } }),
        api.get(`/api/stores/${storeId}/products/commercial`, { params: { from, to } }),
        api.get(`/api/stores/${storeId}/metrics?from=${from}&to=${to}`),
      ]);
      setData(res);
      setOverview(overviewRes);
      setCommercial(commercialRes);
      setStoreMetrics(metricsRes);
    } catch {
      setData({ products: [], total: 0 });
      setOverview(null);
      setCommercial(null);
      setStoreMetrics(null);
    }
    setLoading(false);
  }, [storeId, from, to, page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  if (loading) {
    return <div className="text-center py-12 text-[13px] text-gray-600">Cargando productos...</div>;
  }

  const currentMetrics = storeMetrics?.current || null;
  const productRevenue = overview?.summary?.periodRevenue || 0;
  const storeRevenue = currentMetrics?.revenue || 0;
  const storeNetRevenue = currentMetrics?.netRevenue || 0;
  const revenueGap = storeRevenue - productRevenue;
  const netRevenueGap = storeNetRevenue - productRevenue;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Productos</h1>
        <p className="page-subtitle">Performance, márgenes y stock de tus {data.total} productos con ventas pagadas e ingresos netos de descuentos.</p>
      </div>

      {overview?.summary && (
        <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
          {[
            {
              label: 'Stock valorizado',
              // Si no hay costos cargados, valorizado da $0 que es engañoso.
              // Mostrar "Sin datos" para que el usuario sepa que falta cargar costos.
              value: (overview.summary.stockValue || 0) > 0 ? fmt(overview.summary.stockValue) : 'Sin datos',
              coverageAware: true,
            },
            { label: 'Ingresos período', value: fmt(overview.summary.periodRevenue) },
            { label: 'Unidades vendidas', value: overview.summary.periodSales || 0 },
            { label: 'Dead stock', value: overview.summary.deadStockCount || 0 },
            { label: 'Bajo retorno', value: overview.summary.lowReturnCount || 0 },
            { label: 'Sobrestock', value: overview.summary.overstockCount || 0 },
          ].map((card) => (
            <div key={card.label} className="card p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-app-muted text-[10px] uppercase tracking-[0.18em]">{card.label}</p>
                {card.coverageAware && coverage?.isPreliminary && (
                  <MetricCompleteness coverage={coverage} storeId={storeId} size="sm" />
                )}
              </div>
              <p className="text-white text-lg font-semibold mt-2">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {overview?.summary && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="card p-4">
            <div className="mb-3">
              <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Cobertura de costos</p>
              <h2 className="text-white text-lg font-semibold mt-1">Qué tan accionable es el margen</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Con costo</p>
                <p className="text-white text-lg font-semibold mt-2">{overview.summary.productsWithCosts || 0}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Sin costo</p>
                <p className="text-white text-lg font-semibold mt-2">{overview.summary.productsWithoutCosts || 0}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Cobertura</p>
                <p className="text-white text-lg font-semibold mt-2">{(overview.summary.costCoveragePct || 0).toFixed(0)}%</p>
              </div>
            </div>
            <p className="text-app-secondary text-[12px] mt-4">
              Si la cobertura es baja, esta vista sirve muy bien para rotación, stock y surtido, pero no todavía para margen real por producto.
            </p>
          </div>

          <div className="card p-4">
            <div className="mb-3">
              <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Conciliación con tienda</p>
              <h2 className="text-white text-lg font-semibold mt-1">Por qué productos y tienda no siempre cierran igual</h2>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Tienda ingresos</p>
                <p className="text-white text-lg font-semibold mt-2">{fmt(storeRevenue)}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Tienda neto</p>
                <p className="text-white text-lg font-semibold mt-2">{fmt(storeNetRevenue)}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Productos</p>
                <p className="text-white text-lg font-semibold mt-2">{fmt(productRevenue)}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-app-muted text-[10px] uppercase tracking-[0.16em]">Gap vs neto</p>
                <p className={`text-lg font-semibold mt-2 ${Math.abs(netRevenueGap) <= 1 ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {fmt(netRevenueGap)}
                </p>
              </div>
            </div>
            <p className="text-app-secondary text-[12px] mt-4">
              La vista de productos reparte descuentos de pedido sobre los ítems, pero no representa envío ni todos los ajustes del pedido. Por eso comparala primero contra <span className="text-white">net revenue</span>, no contra ingresos brutos de tienda.
            </p>
            <p className="text-app-secondary text-[12px] mt-2">
              Gap contra ingresos brutos: <span className="text-white">{fmt(revenueGap)}</span>
            </p>
          </div>
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            { title: 'Top sellers', items: overview.topSellers },
            { title: 'Stock lento', items: overview.lowRotation },
            { title: 'Dead stock / bajo retorno', items: [...overview.deadStock, ...overview.lowReturn].slice(0, 5) },
          ].map((block) => (
            <div key={block.title} className="card p-4">
              <p className="text-app-muted text-[11px] uppercase tracking-[0.18em] mb-3">{block.title}</p>
              <div className="space-y-2">
                {block.items?.length ? block.items.map((item) => (
                  <div key={item._id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-white text-[12px] font-medium truncate">{item.nombre}</p>
                      <p className="text-app-secondary text-[11px] truncate">
                        Ventas {item.periodSales || 0} · Stock {item.stock || 0}
                      </p>
                    </div>
                    <div className="text-right text-[11px] text-app-secondary shrink-0">
                      {fmt(item.periodRevenue || item.stockValue || 0)}
                    </div>
                  </div>
                )) : (
                  <p className="text-app-secondary text-[12px]">Sin datos suficientes.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {commercial?.categories?.length > 0 && (
        <div className="card p-4 overflow-x-auto">
          <div className="mb-3">
            <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Comercial por categoría</p>
            <h2 className="text-white text-lg font-semibold mt-1">Surtido, cobertura y margen</h2>
          </div>
          <table className="w-full table-dark">
            <thead>
              <tr>
                <th className="text-left">Categoría</th>
                <th className="text-right">Ingresos</th>
                <th className="text-right">Unidades</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Stock valorizado</th>
                <th className="text-right">Margen %</th>
                <th className="text-right">Cobertura</th>
              </tr>
            </thead>
            <tbody>
              {commercial.categories.map((category) => (
                <tr key={category.categoria}>
                  <td className="font-medium text-white">{category.categoria}</td>
                  <td className="text-right tabular-nums">{fmt(category.revenue)}</td>
                  <td className="text-right">{category.unitsSold || 0}</td>
                  <td className="text-right">{category.stockUnits || 0}</td>
                  <td className="text-right tabular-nums">{fmt(category.stockValue)}</td>
                  <td className="text-right">{category.grossMarginPct?.toFixed(1) || '0.0'}%</td>
                  <td className="text-right">{category.coverageDays ? `${category.coverageDays.toFixed(0)}d` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {commercial?.agingSummary?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4">
            <p className="text-app-muted text-[11px] uppercase tracking-[0.18em] mb-3">Aging de stock</p>
            <div className="space-y-2">
              {commercial.agingSummary.map((bucket) => (
                <div key={bucket.label} className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                  <div>
                    <p className="text-white text-[12px] font-medium">{bucket.label}</p>
                    <p className="text-app-secondary text-[11px]">{bucket.products} productos</p>
                  </div>
                  <p className="text-app-primary text-[12px] font-semibold">{fmt(bucket.stockValue)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <p className="text-app-muted text-[11px] uppercase tracking-[0.18em] mb-3">Concentración por categoría</p>
            <div className="space-y-2">
              {commercial.categoryConcentration.map((item) => (
                <div key={item.categoria} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-white text-[12px] font-medium">{item.categoria}</p>
                    <p className="text-app-primary text-[12px] font-semibold">{fmt(item.revenue)}</p>
                  </div>
                  <p className="text-app-secondary text-[11px] mt-1">
                    Ingresos {item.revenueSharePct?.toFixed(1) || '0.0'}% · Stock {item.stockSharePct?.toFixed(1) || '0.0'}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {commercial?.assortmentMatrix && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {[
            ['Stars', commercial.assortmentMatrix.stars],
            ['Sleepers', commercial.assortmentMatrix.sleepers],
            ['Dead Stock', commercial.assortmentMatrix.deadStock],
            ['Low Return', commercial.assortmentMatrix.lowReturn],
          ].map(([label, items]) => (
            <div key={label} className="card p-4">
              <p className="text-app-muted text-[11px] uppercase tracking-[0.18em] mb-3">{label}</p>
              <div className="space-y-2">
                {items?.length ? items.map((item) => (
                  <div key={item._id} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                    <p className="text-white text-[12px] font-medium truncate">{item.nombre}</p>
                    <p className="text-app-secondary text-[11px] mt-1">
                      Ventas {item.periodSales || 0} · {fmt(item.periodRevenue || item.stockValue || 0)}
                    </p>
                  </div>
                )) : (
                  <p className="text-app-secondary text-[12px]">Sin casos.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {commercial?.stockHealth && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {[
            ['Sobrestock', commercial.stockHealth.overstock],
            ['Riesgo quiebre', commercial.stockHealth.stockout],
            ['Trampas de capital', commercial.stockHealth.capitalTraps],
            ['Presión promocional', commercial.stockHealth.promoPressure],
          ].map(([label, items]) => (
            <div key={label} className="card p-4">
              <p className="text-app-muted text-[11px] uppercase tracking-[0.18em] mb-3">{label}</p>
              <div className="space-y-2">
                {items?.length ? items.map((item) => (
                  <div key={item._id} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                    <p className="text-white text-[12px] font-medium truncate">{item.nombre}</p>
                    <p className="text-app-secondary text-[11px] mt-1">
                      {item.daysOfStock ? `${item.daysOfStock.toFixed(0)}d` : item.lastSaleDays != null ? `${item.lastSaleDays} días sin venta` : 'Sin historial'} · {fmt(item.stockValue || item.periodRevenue || 0)}
                    </p>
                  </div>
                )) : (
                  <p className="text-app-secondary text-[12px]">Sin casos.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full table-dark">
          <thead>
            <tr>
              {['Producto', 'ID', 'Estado', 'Categoría', 'Subcategoría', 'Precio', 'COGS', 'Margen %', 'Stock', 'Ventas período', 'Ingresos período', 'Velocidad', 'Días stock', 'Link', ''].map((h) => (
                <th key={h} className="text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.products.map((p) => (
              <tr key={p._id} className="cursor-pointer" onClick={() => setSelected(p)}>
                <td>
                  <div className="flex items-center gap-2">
                    {p.imagenUrl && <img src={p.imagenUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                    <div className="min-w-0">
                      <span className="font-medium text-white truncate max-w-[220px] block">{p.nombre}</span>
                      <span className="text-app-secondary text-[11px] truncate block">{p.sku || 'Sin SKU'}</span>
                    </div>
                  </div>
                </td>
                <td className="tabular-nums text-app-secondary">{p.tnProductId}</td>
                <td><EstadoBadge activo={p.activo} estadoPublicacion={p.estadoPublicacion} /></td>
                <td className="text-app-secondary">{p.categoria || '—'}</td>
                <td className="text-app-secondary">{p.subcategoria || '—'}</td>
                <td className="tabular-nums">{fmt(p.precio)}</td>
                <td className="tabular-nums">{fmt(p.costoUnitario)}</td>
                <td>
                  <span className={`text-[12px] font-semibold tabular-nums ${(p.margenBrutoPct || 0) > 30 ? 'text-emerald-400' : (p.margenBrutoPct || 0) > 15 ? 'text-amber-400' : 'text-red-400'}`}>
                    {p.margenBrutoPct ? `${p.margenBrutoPct.toFixed(1)}%` : '—'}
                  </span>
                </td>
                <td>
                  <span className="text-gray-300">{p.stock}</span>
                  <StockBadge stock={p.stock} ventas30dias={p.ventas30dias} ultimaVenta={p.ultimaVenta} />
                </td>
                <td className="tabular-nums">{p.periodSales || 0}</td>
                <td className="tabular-nums">{fmt(p.periodRevenue)}</td>
                <td className="tabular-nums">{p.velocity?.toFixed(1) || '—'}</td>
                <td className="tabular-nums">{p.diasDeStock || '—'}</td>
                <td>
                  {p.productUrl ? (
                    <a
                      href={p.productUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-app-primary text-[12px] hover:underline"
                    >
                      Ver
                    </a>
                  ) : '—'}
                </td>
                <td className="text-gray-700">→</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.total > 50 && (
        <div className="flex justify-center items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-ghost text-[12px] py-1.5 px-3 disabled:opacity-40">Anterior</button>
          <span className="text-[12px] text-gray-500">Pág. {page} de {Math.ceil(data.total / 50)}</span>
          <button disabled={page >= Math.ceil(data.total / 50)} onClick={() => setPage(page + 1)} className="btn-ghost text-[12px] py-1.5 px-3 disabled:opacity-40">Siguiente</button>
        </div>
      )}

      {selected && (
        <ProductProfileModal storeId={storeId} product={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
