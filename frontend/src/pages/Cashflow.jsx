import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import AIAnalysisPanel from '../components/common/AIAnalysisPanel';
import ClaudeActionBar from '../components/common/ClaudeActionBar';
import TopInsightBar from '../components/insights/TopInsightBar';
import UnifiedProjectionChart from '../components/cashflow/UnifiedProjectionChart';
import BankBalancesPanel from '../components/cashflow/BankBalancesPanel';
import ManualMovementsTable from '../components/cashflow/ManualMovementsTable';

export default function Cashflow() {
  const { storeId } = useParams();
  const { from, to } = useSelector((s) => s.date);
  const store = useSelector((state) => state.stores.stores.find((item) => item._id === storeId));

  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [projection, setProjection] = useState(null);
  const [categories, setCategories] = useState(null);
  const [days, setDays] = useState(60);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [accRes, entRes, projRes, catRes] = await Promise.all([
        api.get(`/api/stores/${storeId}/cashflow/accounts`),
        api.get(`/api/stores/${storeId}/cashflow/manual`),
        api.get(`/api/stores/${storeId}/cashflow/projection`, { params: { days } }),
        api.get(`/api/stores/${storeId}/cashflow/categories`),
      ]);
      setAccounts(accRes.data || []);
      setEntries(entRes.data || []);
      setProjection(projRes.data || null);
      setCategories(catRes.data || null);
    } catch {
      setAccounts([]); setEntries([]); setProjection(null);
    }
    setLoading(false);
  }, [storeId, days]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const refreshProjection = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/stores/${storeId}/cashflow/projection`, { params: { days } });
      setProjection(data);
    } catch {}
  }, [storeId, days]);

  const handleAccountUpsert = async (payload) => {
    await api.post(`/api/stores/${storeId}/cashflow/accounts`, payload);
    const { data } = await api.get(`/api/stores/${storeId}/cashflow/accounts`);
    setAccounts(data || []);
    refreshProjection();
  };

  const handleAccountArchive = async (id) => {
    await api.delete(`/api/stores/${storeId}/cashflow/accounts/${id}`);
    setAccounts((curr) => curr.filter((a) => a._id !== id));
    refreshProjection();
  };

  const handleEntryUpsert = async (payload) => {
    await api.post(`/api/stores/${storeId}/cashflow/manual`, payload);
    const { data } = await api.get(`/api/stores/${storeId}/cashflow/manual`);
    setEntries(data || []);
    refreshProjection();
  };

  const handleEntryDelete = async (id) => {
    await api.delete(`/api/stores/${storeId}/cashflow/manual/${id}`);
    setEntries((curr) => curr.filter((e) => e._id !== id));
    refreshProjection();
  };

  if (loading) {
    return <div className="text-center py-12 text-[13px] text-gray-600">Cargando cashflow...</div>;
  }

  return (
    <div className="space-y-5">
      <TopInsightBar storeId={storeId} />

      {/* 1. Forecast unificado con cash gap detector */}
      <UnifiedProjectionChart data={projection} onChangeDays={setDays} />

      {/* 2. Saldos bancarios del momento */}
      <BankBalancesPanel
        accounts={accounts}
        categories={categories}
        onUpsert={handleAccountUpsert}
        onArchive={handleAccountArchive}
      />

      {/* 3. Movimientos manuales (ingresos no-TN + egresos) */}
      <ManualMovementsTable
        entries={entries}
        categories={categories}
        onUpsert={handleEntryUpsert}
        onDelete={handleEntryDelete}
      />

      <div className="card p-5 space-y-4">
        <div>
          <p className="text-app-muted text-[11px] uppercase tracking-[0.18em]">Análisis asistido</p>
          <p className="text-app-secondary text-[12px] mt-1">
            Prompts y análisis largos quedan al final para no competir con la proyección de cashflow.
          </p>
        </div>
        <ClaudeActionBar storeId={storeId} storeName={store?.nombre} from={from} to={to} mode="cashflow" />
        <AIAnalysisPanel storeId={storeId} section="cashflow" from={from} to={to} />
      </div>
    </div>
  );
}
