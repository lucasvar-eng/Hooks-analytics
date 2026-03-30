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
    { label: 'Liquidable', value: summary.totalLiquidable, format: 'currency', color: 'text-blue-400' },
    { label: 'Descuentos', value: summary.totalDescuentos, format: 'currency', color: 'text-amber-400' },
    { label: 'Cuotas promedio', value: summary.avgCuotas?.toFixed(1), format: 'raw' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="card p-4">
          <p className="kpi-label">{c.label}</p>
          <p className={`text-[20px] font-bold mt-1.5 leading-none ${c.color || 'text-white'}`}>
            {c.format === 'currency' ? fmt(c.value) : c.format === 'number' ? (c.value || 0).toLocaleString('es-AR') : c.value || '—'}
          </p>
        </div>
      ))}
    </div>
  );
}

function MedioPagoTable({ data }) {
  if (!data || data.length === 0) return <p className="text-[13px] text-gray-600 text-center py-8">Sin datos de medios de pago.</p>;

  const total = data.reduce((s, d) => ({ ordenes: s.ordenes + d.ordenes, revenue: s.revenue + d.revenue, comisionPago: s.comisionPago + d.comisionPago, comisionCuotas: s.comisionCuotas + d.comisionCuotas }), { ordenes: 0, revenue: 0, comisionPago: 0, comisionCuotas: 0 });

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-dark">
        <thead>
          <tr>
            {['Gateway', 'Órdenes', '%', 'Revenue', 'Com. pago', 'Com. cuotas', 'Cuotas prom.'].map((h) => (
              <th key={h} className="text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d._id || 'unknown'}>
              <td className="font-medium text-white">{d._id || 'Sin gateway'}</td>
              <td>{d.ordenes}</td>
              <td>{total.ordenes > 0 ? pct((d.ordenes / total.ordenes) * 100) : '—'}</td>
              <td className="tabular-nums">{fmt(d.revenue)}</td>
              <td className="text-red-400 tabular-nums">{fmt(d.comisionPago)}</td>
              <td className="text-red-400 tabular-nums">{fmt(d.comisionCuotas)}</td>
              <td>{d.avgCuotas?.toFixed(1)}</td>
            </tr>
          ))}
          <tr className="bg-white/[0.03] font-semibold">
            <td className="text-white">TOTAL</td>
            <td>{total.ordenes}</td>
            <td>100%</td>
            <td className="tabular-nums">{fmt(total.revenue)}</td>
            <td className="text-red-400 tabular-nums">{fmt(total.comisionPago)}</td>
            <td className="text-red-400 tabular-nums">{fmt(total.comisionCuotas)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function NCRCCards({ ncrc }) {
  if (!ncrc) return null;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="card p-4">
        <p className="kpi-label mb-1">Nuevos Clientes (NC)</p>
        <p className="text-[24px] font-bold text-blue-400">{ncrc.nc.ordenes}</p>
        <p className="text-[12px] text-gray-600 mt-1">Revenue: {fmt(ncrc.nc.revenue)}</p>
        <p className="text-[12px] text-gray-600">AOV: {fmt(ncrc.nc.aov)}</p>
      </div>
      <div className="card p-4">
        <p className="kpi-label mb-1">Clientes Recurrentes (RC)</p>
        <p className="text-[24px] font-bold text-emerald-400">{ncrc.rc.ordenes}</p>
        <p className="text-[12px] text-gray-600 mt-1">Revenue: {fmt(ncrc.rc.revenue)}</p>
        <p className="text-[12px] text-gray-600">AOV: {fmt(ncrc.rc.aov)}</p>
      </div>
      <div className="card p-4">
        <p className="kpi-label mb-1">Ratio NC</p>
        <p className="text-[24px] font-bold text-white">{pct(ncrc.ncPct)}</p>
        <p className="text-[12px] text-gray-600 mt-1">del total de órdenes</p>
      </div>
    </div>
  );
}

function DailyOrdersTable({ data }) {
  if (!data || data.length === 0) return <p className="text-[13px] text-gray-600 text-center py-8">Sin datos diarios.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-dark">
        <thead>
          <tr>
            {['Fecha', 'Órdenes', 'Revenue', 'Net Revenue', 'NC', 'RC'].map((h) => (
              <th key={h} className="text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d._id}>
              <td className="font-medium text-white">{d._id}</td>
              <td>{d.ordenes}</td>
              <td className="tabular-nums">{fmt(d.revenue)}</td>
              <td className="tabular-nums">{fmt(d.netRevenue)}</td>
              <td className="text-blue-400">{d.ncOrdenes}</td>
              <td className="text-emerald-400">{d.rcOrdenes}</td>
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
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Top 10 clientes del período</p>
      <table className="w-full table-dark">
        <thead>
          <tr>
            {['Cliente', 'Email', 'Órdenes', 'Revenue'].map((h) => (
              <th key={h} className="text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((c, i) => (
            <tr key={i}>
              <td className="font-medium text-white">{c.name || '—'}</td>
              <td className="text-[11px]">{c._id}</td>
              <td>{c.ordenes}</td>
              <td className="font-semibold text-white tabular-nums">{fmt(c.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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

  if (loading) return <div className="text-center py-12 text-[13px] text-gray-600">Cargando datos de tienda...</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Tienda</h1>
        <p className="page-subtitle">Análisis de órdenes, medios de pago y clientes del período.</p>
      </div>

      <SummaryCards summary={data?.summary} />

      {/* Devoluciones */}
      <div className="card p-4 w-fit">
        <p className="kpi-label">Devoluciones / Cancelaciones</p>
        <p className="text-[22px] font-bold text-red-400 mt-1.5 leading-none">{data?.devoluciones?.count || 0}</p>
        <p className="text-[12px] text-gray-600 mt-1">Total: {fmt(data?.devoluciones?.total)}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/[0.06] pb-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition ${
              tab === t.key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card">
        {tab === 'resumen' && (
          <div className="p-1 space-y-4">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Desglose de costos</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'COGS', value: data?.summary?.totalCostoProductos },
                { label: 'Comisión Pago', value: data?.summary?.totalComisionPago },
                { label: 'Comisión Cuotas', value: data?.summary?.totalComisionCuotas },
                { label: 'Impuestos IBB', value: data?.summary?.totalIBB },
                { label: 'Fee Plataforma', value: data?.summary?.totalFeePlataforma },
                { label: 'Costo Envío', value: data?.summary?.totalCostoEnvio },
              ].map((c) => (
                <div key={c.label} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
                  <p className="kpi-label">{c.label}</p>
                  <p className="text-[18px] font-bold text-red-400 mt-1">{fmt(c.value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'medios' && <MedioPagoTable data={data?.byMedioPago} />}

        {tab === 'ncrc' && (
          <div className="p-1">
            <NCRCCards ncrc={data?.ncrc} />
          </div>
        )}

        {tab === 'diario' && <DailyOrdersTable data={data?.dailyOrders} />}

        {tab === 'top' && (
          <div className="p-1">
            <TopCustomersTable data={data?.topCustomers} />
          </div>
        )}
      </div>

      <AIAnalysisPanel storeId={storeId} section="dashboard" from={from} to={to} />
    </div>
  );
}