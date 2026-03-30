import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import AIAnalysisPanel from '../components/common/AIAnalysisPanel';

function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function pct(v) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(1)}%`;
}

function SummaryCards({ summary }) {
  if (!summary) return null;

  const cards = [
    { label: 'Órdenes', value: summary.totalOrdenes, format: 'number' },
    { label: 'Revenue', value: summary.totalRevenue, format: 'currency' },
    { label: 'Net Revenue', value: summary.totalNeto, format: 'currency' },
    { label: 'AOV', value: summary.aov, format: 'currency' },
    { label: 'AOV Neto', value: summary.aovNeto, format: 'currency' },
    { label: 'Liquidable', value: summary.totalLiquidable, format: 'currency', color: 'text-cyan-600' },
    { label: 'Descuentos', value: summary.totalDescuentos, format: 'currency', color: 'text-orange-500' },
    { label: 'Cuotas promedio', value: summary.avgCuotas?.toFixed(1), format: 'raw' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{c.label}</p>
          <p className={`text-lg font-bold mt-1 ${c.color || 'text-gray-900 dark:text-gray-100'}`}>
            {c.format === 'currency' ? fmt(c.value) : c.format === 'number' ? (c.value || 0).toLocaleString('es-AR') : c.value || '—'}
          </p>
        </div>
      ))}
    </div>
  );
}

function MedioPagoTable({ data }) {
  if (!data || data.length === 0) return <p className="text-gray-500 text-sm text-center py-4">Sin datos de medios de pago.</p>;

  const total = data.reduce((s, d) => ({ ordenes: s.ordenes + d.ordenes, revenue: s.revenue + d.revenue, comisionPago: s.comisionPago + d.comisionPago, comisionCuotas: s.comisionCuotas + d.comisionCuotas }), { ordenes: 0, revenue: 0, comisionPago: 0, comisionCuotas: 0 });

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 dark:bg-gray-750">
          {['Gateway', 'Órdenes', '%', 'Revenue', 'Comisión pago', 'Comisión cuotas', 'Cuotas prom.'].map((h) => (
            <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
        {data.map((d) => (
          <tr key={d._id || 'unknown'} className="hover:bg-gray-50 dark:hover:bg-gray-750">
            <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{d._id || 'Sin gateway'}</td>
            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{d.ordenes}</td>
            <td className="px-3 py-2 text-gray-500">{total.ordenes > 0 ? pct((d.ordenes / total.ordenes) * 100) : '—'}</td>
            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{fmt(d.revenue)}</td>
            <td className="px-3 py-2 text-red-500">{fmt(d.comisionPago)}</td>
            <td className="px-3 py-2 text-red-500">{fmt(d.comisionCuotas)}</td>
            <td className="px-3 py-2 text-gray-500">{d.avgCuotas?.toFixed(1)}</td>
          </tr>
        ))}
        <tr className="bg-gray-50 dark:bg-gray-750 font-semibold">
          <td className="px-3 py-2">TOTAL</td>
          <td className="px-3 py-2">{total.ordenes}</td>
          <td className="px-3 py-2">100%</td>
          <td className="px-3 py-2">{fmt(total.revenue)}</td>
          <td className="px-3 py-2 text-red-500">{fmt(total.comisionPago)}</td>
          <td className="px-3 py-2 text-red-500">{fmt(total.comisionCuotas)}</td>
          <td className="px-3 py-2"></td>
        </tr>
      </tbody>
    </table>
  );
}

function NCRCCards({ ncrc }) {
  if (!ncrc) return null;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
        <h4 className="text-xs text-gray-500 uppercase mb-2">Nuevos Clientes (NC)</h4>
        <p className="text-2xl font-bold text-blue-600">{ncrc.nc.ordenes}</p>
        <p className="text-sm text-gray-500 mt-1">Revenue: {fmt(ncrc.nc.revenue)}</p>
        <p className="text-sm text-gray-500">AOV: {fmt(ncrc.nc.aov)}</p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
        <h4 className="text-xs text-gray-500 uppercase mb-2">Clientes Recurrentes (RC)</h4>
        <p className="text-2xl font-bold text-green-600">{ncrc.rc.ordenes}</p>
        <p className="text-sm text-gray-500 mt-1">Revenue: {fmt(ncrc.rc.revenue)}</p>
        <p className="text-sm text-gray-500">AOV: {fmt(ncrc.rc.aov)}</p>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
        <h4 className="text-xs text-gray-500 uppercase mb-2">Ratio NC</h4>
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pct(ncrc.ncPct)}</p>
        <p className="text-sm text-gray-500 mt-1">del total de órdenes</p>
      </div>
    </div>
  );
}

function DailyOrdersTable({ data }) {
  if (!data || data.length === 0) return <p className="text-gray-500 text-sm text-center py-4">Sin datos diarios.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-750">
            {['Fecha', 'Órdenes', 'Revenue', 'Net Revenue', 'NC', 'RC'].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {data.map((d) => (
            <tr key={d._id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
              <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{d._id}</td>
              <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{d.ordenes}</td>
              <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{fmt(d.revenue)}</td>
              <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{fmt(d.netRevenue)}</td>
              <td className="px-3 py-2 text-blue-600">{d.ncOrdenes}</td>
              <td className="px-3 py-2 text-green-600">{d.rcOrdenes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopCustomersTable({ data }) {
  if (!data || data.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">Top 10 clientes del período</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-750">
            {['Cliente', 'Email', 'Órdenes', 'Revenue'].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {data.map((c, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-750">
              <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{c.name || '—'}</td>
              <td className="px-3 py-2 text-gray-500 text-xs">{c._id}</td>
              <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{c.ordenes}</td>
              <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{fmt(c.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DevolucionesCard({ data }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
      <h3 className="text-xs text-gray-500 uppercase mb-1">Devoluciones / Cancelaciones</h3>
      <p className="text-xl font-bold text-red-500">{data?.count || 0}</p>
      <p className="text-sm text-gray-500">Total: {fmt(data?.total)}</p>
    </div>
  );
}

const TABS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'medios', label: 'Medios de Pago' },
  { key: 'ncrc', label: 'NC / RC' },
  { key: 'diario', label: 'Detalle Diario' },
  { key: 'top', label: 'Top Clientes' },
];

export default function Tienda() {
  const { storeId } = useParams();
  const { from, to } = useSelector((s) => s.date);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('resumen');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const { data: res } = await api.get(`/api/stores/${storeId}/tienda/breakdown`, { params });
      setData(res);
    } catch {
      setData(null);
    }
    setLoading(false);
  }, [storeId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando datos de tienda...</div>;

  return (
    <div className="space-y-5">
      <p className="section-label">Tienda</p>

      {/* Summary cards always visible */}
      <SummaryCards summary={data?.summary} />

      <div className="flex items-center gap-3">
        <DevolucionesCard data={data?.devoluciones} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-750 rounded-lg p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-md transition ${
              tab === t.key
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60">
        {tab === 'resumen' && (
          <div className="p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase">Desglose de costos</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'COGS', value: data?.summary?.totalCostoProductos },
                { label: 'Comisión Pago', value: data?.summary?.totalComisionPago },
                { label: 'Comisión Cuotas', value: data?.summary?.totalComisionCuotas },
                { label: 'Impuestos IBB', value: data?.summary?.totalIBB },
                { label: 'Fee Plataforma', value: data?.summary?.totalFeePlataforma },
                { label: 'Costo Envío', value: data?.summary?.totalCostoEnvio },
              ].map((c) => (
                <div key={c.label}>
                  <p className="text-xs text-gray-500">{c.label}</p>
                  <p className="text-lg font-bold text-red-500">{fmt(c.value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'medios' && <MedioPagoTable data={data?.byMedioPago} />}

        {tab === 'ncrc' && (
          <div className="p-4">
            <NCRCCards ncrc={data?.ncrc} />
          </div>
        )}

        {tab === 'diario' && <DailyOrdersTable data={data?.dailyOrders} />}

        {tab === 'top' && (
          <div className="p-4">
            <TopCustomersTable data={data?.topCustomers} />
          </div>
        )}
      </div>

      {/* AI Analysis */}
      <AIAnalysisPanel storeId={storeId} section="dashboard" from={from} to={to} />
    </div>
  );
}
