import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import AIAnalysisPanel from '../components/common/AIAnalysisPanel';

function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

const SEGMENT_STYLES = {
  champions: 'badge-green',
  loyal: 'badge-blue',
  new: 'bg-cyan-500/15 text-cyan-400 badge',
  promising: 'badge-blue',
  potential: 'bg-purple-500/15 text-purple-400 badge',
  at_risk: 'badge-amber',
  lost: 'badge-red',
  hibernating: 'badge-gray',
};

const SEGMENT_LABELS = {
  champions: 'Champions',
  loyal: 'Loyal',
  new: 'Nuevos',
  promising: 'Promising',
  potential: 'Potential',
  at_risk: 'At Risk',
  lost: 'Lost',
  hibernating: 'Hibernating',
};

function SegmentCards({ segments, selected, onSelect }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {segments.map((s) => (
        <button
          key={s._id}
          onClick={() => onSelect(selected === s._id ? null : s._id)}
          className={`card p-3.5 text-left transition ${
            selected === s._id ? 'ring-1 ring-blue-500' : ''
          }`}
        >
          <span className={`${SEGMENT_STYLES[s._id] || 'badge-gray'}`}>
            {SEGMENT_LABELS[s._id] || s._id}
          </span>
          <p className="text-[22px] font-bold text-white mt-2 leading-none">{s.count}</p>
          <p className="text-[11px] text-gray-600 mt-1">{fmt(s.totalRevenue)} revenue</p>
        </button>
      ))}
    </div>
  );
}

function CohortTableView({ cohorts }) {
  if (!cohorts || cohorts.length === 0) {
    return <p className="text-gray-600 text-[13px] text-center py-4">Sin datos de cohorts.</p>;
  }

  const maxMonth = Math.max(...cohorts.flatMap((c) => Object.keys(c.retention).map(Number)));
  const monthHeaders = Array.from({ length: Math.min(maxMonth + 1, 12) }, (_, i) => i);

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-dark">
        <thead>
          <tr>
            <th className="text-left">Cohorte</th>
            <th>Total</th>
            {monthHeaders.map((m) => (
              <th key={m}>M{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.cohortMonth}>
              <td className="font-medium text-white">{c.cohortMonth}</td>
              <td className="text-center">{c.total}</td>
              {monthHeaders.map((m) => {
                const val = c.retention[m];
                const bg = val > 50 ? 'bg-emerald-500/15 text-emerald-400' : val > 20 ? 'bg-amber-500/10 text-amber-400' : '';
                return (
                  <td key={m} className={`text-center ${bg}`}>
                    {val != null ? `${val.toFixed(0)}%` : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomerTable({ customers }) {
  // LTV y Total gastado son la misma métrica hoy (no hay churn ni proyección futura
  // en el cálculo). Si en el futuro LTV se calcula distinto, volver a separar.
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-dark">
        <thead>
          <tr>
            {['Cliente', 'Email', 'Órdenes', 'LTV', 'Segmento', 'Recencia (días)', 'Primera compra'].map((h) => (
              <th key={h} className="text-left whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c._id}>
              <td className="font-medium text-white">{c.name || '—'}</td>
              <td className="text-[11px]">{c.email}</td>
              <td>{c.totalOrders}</td>
              <td className="font-semibold text-white">{fmt(c.ltv ?? c.totalSpent)}</td>
              <td>
                <span className={SEGMENT_STYLES[c.rfmSegment] || 'badge-gray'}>
                  {SEGMENT_LABELS[c.rfmSegment] || c.rfmSegment || '—'}
                </span>
              </td>
              <td>{c.recency ?? '—'}</td>
              <td className="text-[11px]">{c.firstPurchase ? new Date(c.firstPurchase).toLocaleDateString('es-AR') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Clientes() {
  const { storeId } = useParams();
  const [segments, setSegments] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [quality, setQuality] = useState(null);
  const [customerData, setCustomerData] = useState({ customers: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [tab, setTab] = useState('segments');
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [segRes, cohortRes] = await Promise.all([
        api.get(`/api/stores/${storeId}/customers/segments`),
        api.get(`/api/stores/${storeId}/customers/cohorts`),
      ]);
      setSegments(segRes.data);
      setCohorts(cohortRes.data);
      api.get(`/api/stores/${storeId}/customers/quality`).then(({ data }) => setQuality(data)).catch(() => {});
    } catch {}
    setLoading(false);
  }, [storeId]);

  const fetchCustomers = useCallback(async () => {
    try {
      const params = { page, limit: 50 };
      if (selectedSegment) params.segment = selectedSegment;
      const { data } = await api.get(`/api/stores/${storeId}/customers`, { params });
      setCustomerData(data);
    } catch {}
  }, [storeId, page, selectedSegment]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  if (loading) {
    return <div className="text-center py-12 text-[13px] text-gray-600">Cargando clientes...</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Clientes</h1>
        <p className="page-subtitle">Segmentación RFM, cohorts de retención y lista de clientes ({customerData.total}).</p>
      </div>

      {quality && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="card p-4">
            <p className="text-app-muted text-[10px] uppercase tracking-[0.18em]">Sin email real</p>
            <p className="text-white text-2xl font-semibold mt-2">{quality.customersWithoutRealEmail || 0}</p>
          </div>
          <div className="card p-4">
            <p className="text-app-muted text-[10px] uppercase tracking-[0.18em]">Órdenes sin cliente</p>
            <p className="text-white text-2xl font-semibold mt-2">{quality.ordersWithoutCustomer || 0}</p>
          </div>
          <div className="card p-4">
            <p className="text-app-muted text-[10px] uppercase tracking-[0.18em]">Cohorts débiles</p>
            <p className="text-white text-2xl font-semibold mt-2">{quality.sparseCohorts?.length || 0}</p>
          </div>
        </div>
      )}

      <SegmentCards segments={segments} selected={selectedSegment} onSelect={(s) => { setSelectedSegment(s); setPage(1); }} />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/[0.06] pb-0">
        {[
          { key: 'segments', label: 'Lista de clientes' },
          { key: 'cohorts', label: 'Cohorts (retención)' },
        ].map((t) => (
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

      <div className="card">
        {tab === 'cohorts' ? (
          <CohortTableView cohorts={cohorts} />
        ) : (
          <CustomerTable customers={customerData.customers} />
        )}
      </div>

      {/* Pagination */}
      {tab === 'segments' && customerData.total > 50 && (
        <div className="flex justify-center items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="btn-ghost text-[12px] py-1.5 px-3 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-[12px] text-gray-500">Pág. {page} de {Math.ceil(customerData.total / 50)}</span>
          <button
            disabled={page >= Math.ceil(customerData.total / 50)}
            onClick={() => setPage(page + 1)}
            className="btn-ghost text-[12px] py-1.5 px-3 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}

      <AIAnalysisPanel storeId={storeId} section="clientes" from={undefined} to={undefined} />
    </div>
  );
}
