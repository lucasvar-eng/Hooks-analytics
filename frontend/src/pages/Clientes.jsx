import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import AIAnalysisPanel from '../components/common/AIAnalysisPanel';

function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

const SEGMENT_COLORS = {
  champions: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  loyal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  new: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  promising: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  potential: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  at_risk: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  hibernating: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
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
          className={`p-3 rounded-lg border text-left transition ${
            selected === s._id
              ? 'ring-2 ring-indigo-500 border-indigo-300'
              : 'border-gray-200 dark:border-gray-700/60'
          } bg-white dark:bg-gray-800`}
        >
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${SEGMENT_COLORS[s._id] || 'bg-gray-100 text-gray-600'}`}>
            {SEGMENT_LABELS[s._id] || s._id}
          </span>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{s.count}</p>
          <p className="text-xs text-gray-500">{fmt(s.totalRevenue)} revenue</p>
        </button>
      ))}
    </div>
  );
}

function CohortTableView({ cohorts }) {
  if (!cohorts || cohorts.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-4">Sin datos de cohorts.</p>;
  }

  const maxMonth = Math.max(...cohorts.flatMap((c) => Object.keys(c.retention).map(Number)));
  const monthHeaders = Array.from({ length: Math.min(maxMonth + 1, 12) }, (_, i) => i);

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-750">
            <th className="px-2 py-1.5 text-left text-gray-500 uppercase">Cohorte</th>
            <th className="px-2 py-1.5 text-center text-gray-500">Total</th>
            {monthHeaders.map((m) => (
              <th key={m} className="px-2 py-1.5 text-center text-gray-500">M{m}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {cohorts.map((c) => (
            <tr key={c.cohortMonth}>
              <td className="px-2 py-1.5 font-medium text-gray-900 dark:text-gray-100">{c.cohortMonth}</td>
              <td className="px-2 py-1.5 text-center text-gray-700 dark:text-gray-300">{c.total}</td>
              {monthHeaders.map((m) => {
                const val = c.retention[m];
                const bg = val > 50 ? 'bg-green-100 dark:bg-green-900/30' : val > 20 ? 'bg-yellow-50 dark:bg-yellow-900/20' : '';
                return (
                  <td key={m} className={`px-2 py-1.5 text-center ${bg}`}>
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
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 dark:bg-gray-750">
          {['Cliente', 'Email', 'Órdenes', 'Total gastado', 'LTV', 'Segmento', 'Recencia (días)', 'Primera compra'].map((h) => (
            <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
        {customers.map((c) => (
          <tr key={c._id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
            <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{c.name || '—'}</td>
            <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{c.email}</td>
            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{c.totalOrders}</td>
            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{fmt(c.totalSpent)}</td>
            <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{fmt(c.ltv)}</td>
            <td className="px-3 py-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEGMENT_COLORS[c.rfmSegment] || 'bg-gray-100 text-gray-600'}`}>
                {SEGMENT_LABELS[c.rfmSegment] || c.rfmSegment || '—'}
              </span>
            </td>
            <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{c.recency ?? '—'}</td>
            <td className="px-3 py-2 text-gray-500 text-xs">{c.firstPurchase ? new Date(c.firstPurchase).toLocaleDateString('es-AR') : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Clientes() {
  const { storeId } = useParams();
  const [segments, setSegments] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [customerData, setCustomerData] = useState({ customers: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [tab, setTab] = useState('segments'); // 'segments' | 'cohorts' | 'list'
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
    return <div className="text-center py-12 text-gray-500">Cargando clientes...</div>;
  }

  return (
    <div className="space-y-5">
      <p className="section-label">
        Clientes ({customerData.total})
      </p>

      <SegmentCards segments={segments} selected={selectedSegment} onSelect={(s) => { setSelectedSegment(s); setPage(1); }} />

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'segments', label: 'Lista de clientes' },
          { key: 'cohorts', label: 'Cohorts (retención)' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-lg transition ${
              tab === t.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 overflow-x-auto">
        {tab === 'cohorts' ? (
          <CohortTableView cohorts={cohorts} />
        ) : (
          <CustomerTable customers={customerData.customers} />
        )}
      </div>

      {/* Pagination for customer list */}
      {tab === 'segments' && customerData.total > 50 && (
        <div className="flex justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 text-sm rounded border disabled:opacity-50">Anterior</button>
          <span className="px-3 py-1 text-sm text-gray-500">Pág. {page} de {Math.ceil(customerData.total / 50)}</span>
          <button disabled={page >= Math.ceil(customerData.total / 50)} onClick={() => setPage(page + 1)} className="px-3 py-1 text-sm rounded border disabled:opacity-50">Siguiente</button>
        </div>
      )}

      <AIAnalysisPanel storeId={storeId} section="clientes" from={undefined} to={undefined} />
    </div>
  );
}
