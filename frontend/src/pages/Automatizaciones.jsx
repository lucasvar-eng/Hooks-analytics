import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

const EMPTY_FORM = {
  name: '',
  type: 'executive_summary',
  frequency: 'manual',
  active: true,
  config: { fromDaysBack: 7, notes: '' },
};

const TYPE_LABELS = {
  executive_summary: 'Resumen ejecutivo',
  anomaly_watch: 'Anomalías',
  creative_review: 'Revisión creativa',
  catalog_health: 'Salud de catálogo',
};

const STATUS_STYLES = {
  success: 'badge-green',
  error: 'badge-red',
  idle: 'badge-gray',
};

const INTEGRATION_STYLES = {
  connected: 'badge-green',
  disconnected: 'badge-amber',
  planned: 'badge-gray',
};

export default function Automatizaciones() {
  const { storeId } = useParams();
  const [rules, setRules] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [aiStatus, setAiStatus] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState(null);
  const [runningDue, setRunningDue] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, catalogRes, aiStatusRes] = await Promise.all([
        api.get(`/api/stores/${storeId}/automations`),
        api.get(`/api/stores/${storeId}/automations/integrations/catalog`),
        api.get(`/api/stores/${storeId}/automations/ai-status`),
      ]);
      setRules(rulesRes.data);
      setCatalog(catalogRes.data);
      setAiStatus(aiStatusRes.data);
    } catch {
      setRules([]);
      setCatalog([]);
      setAiStatus(null);
    }
    setLoading(false);
  }, [storeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.put(`/api/stores/${storeId}/automations/${editId}`, form);
      } else {
        await api.post(`/api/stores/${storeId}/automations`, form);
      }
      resetForm();
      fetchData();
    } catch {}
  };

  const handleEdit = (rule) => {
    setForm({
      name: rule.name,
      type: rule.type,
      frequency: rule.frequency,
      active: rule.active,
      config: {
        fromDaysBack: rule.config?.fromDaysBack || 7,
        notes: rule.config?.notes || '',
      },
    });
    setEditId(rule._id);
  };

  const handleDelete = async (ruleId) => {
    await api.delete(`/api/stores/${storeId}/automations/${ruleId}`);
    fetchData();
  };

  const handleRun = async (ruleId) => {
    setRunningId(ruleId);
    try {
      await api.post(`/api/stores/${storeId}/automations/${ruleId}/run`);
      fetchData();
    } catch {}
    setRunningId(null);
  };

  const handleRunDue = async () => {
    setRunningDue(true);
    try {
      await api.post(`/api/stores/${storeId}/automations/run-due`);
      fetchData();
    } catch {}
    setRunningDue(false);
  };

  if (loading) {
    return <div className="text-center py-12 text-[13px] text-app-secondary">Cargando automatizaciones...</div>;
  }

  const dueCount = rules.filter((rule) => rule.isDue).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Automatizaciones</h1>
        <p className="page-subtitle">Reglas locales para correr análisis repetidos y base preparada para futuras integraciones.</p>
      </div>

      {aiStatus && (
        <div className={`card p-4 ${aiStatus.ready ? 'border-emerald-500/20' : 'border-amber-500/20'}`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="text-app-muted text-[11px] uppercase tracking-[0.16em]">Motor AI</p>
              <p className={`text-[14px] font-medium mt-1 ${aiStatus.ready ? 'text-emerald-300' : 'text-amber-200'}`}>
                {aiStatus.ready ? `Listo para automatizaciones con ${aiStatus.provider}` : 'Sin AI lista: las reglas caerán a fallback local'}
              </p>
              <p className="text-app-secondary text-[12px] mt-1">
                Modo: {aiStatus.mode === 'user_key' ? 'key personal' : aiStatus.mode === 'env_fallback' ? 'fallback .env' : 'sin configuración'}
              </p>
            </div>
            <div className="text-[12px] text-app-secondary">
              <p>Análisis: <span className="text-white">{aiStatus.models?.analysis || '—'}</span></p>
              <p>Chat: <span className="text-white">{aiStatus.models?.chat || '—'}</span></p>
              <p>Reportes: <span className="text-white">{aiStatus.models?.reports || '—'}</span></p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-app-muted text-[11px] uppercase tracking-[0.16em]">Nueva regla</p>
              <h2 className="text-white text-lg font-semibold mt-1">{editId ? 'Editar automatización' : 'Configurar automatización'}</h2>
            </div>
            {editId && (
              <button type="button" onClick={resetForm} className="btn-secondary">Cancelar</button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="kpi-label mb-1 block">Nombre</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="input-dark w-full" />
            </div>
            <div>
              <label className="kpi-label mb-1 block">Tipo</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-dark w-full">
                <option value="executive_summary">Resumen ejecutivo</option>
                <option value="anomaly_watch">Vigilancia de anomalías</option>
                <option value="creative_review">Revisión creativa</option>
                <option value="catalog_health">Salud de catálogo</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="kpi-label mb-1 block">Frecuencia</label>
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="input-dark w-full">
                <option value="manual">Manual</option>
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
              </select>
            </div>
            <div>
              <label className="kpi-label mb-1 block">Mirar últimos N días</label>
              <input
                type="number"
                min="1"
                max="90"
                value={form.config.fromDaysBack}
                onChange={(e) => setForm({ ...form, config: { ...form.config, fromDaysBack: Number(e.target.value) } })}
                className="input-dark w-full"
              />
            </div>
            <label className="flex items-end gap-2 text-[12px] text-app-secondary">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Activa
            </label>
          </div>
          <div>
            <label className="kpi-label mb-1 block">Notas</label>
            <textarea
              value={form.config.notes}
              onChange={(e) => setForm({ ...form, config: { ...form.config, notes: e.target.value } })}
              rows={3}
              className="input-dark w-full"
            />
          </div>
          <button type="submit" className="btn-primary">{editId ? 'Guardar cambios' : 'Crear automatización'}</button>
        </form>

        <div className="card p-5 space-y-4">
          <div>
            <p className="text-app-muted text-[11px] uppercase tracking-[0.16em]">Integraciones</p>
            <h2 className="text-white text-lg font-semibold mt-1">Mapa de conectores</h2>
          </div>
          <div className="space-y-3">
            {catalog.map((item) => (
              <div key={item.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-white font-medium text-[13px]">{item.name}</p>
                  <span className={INTEGRATION_STYLES[item.status] || 'badge-gray'}>{item.status}</span>
                </div>
                <p className="text-app-secondary text-[12px] mt-2">Modo: {item.mode}</p>
                {item.lastSync && (
                  <p className="text-app-secondary text-[12px] mt-1">
                    Último sync: {new Date(item.lastSync).toLocaleString('es-AR')}
                  </p>
                )}
                <p className="text-app-secondary text-[12px] mt-1">Estado operativo: {item.readiness}</p>
                <p className="text-app-primary text-[12px] mt-1">{item.nextStep}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-app-muted text-[11px] uppercase tracking-[0.16em]">Reglas activas</p>
            <h2 className="text-white text-lg font-semibold mt-1">Corridas automatizadas</h2>
            <p className="text-app-secondary text-[12px] mt-1">{dueCount} reglas listas para correr por frecuencia.</p>
          </div>
          <button onClick={handleRunDue} disabled={runningDue || dueCount === 0} className="btn-primary disabled:opacity-50">
            {runningDue ? 'Corriendo activas...' : `Ejecutar activas (${dueCount})`}
          </button>
        </div>
        {rules.length === 0 ? (
          <p className="text-app-secondary text-[13px]">Todavía no hay automatizaciones configuradas.</p>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule._id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-white font-semibold text-[13px]">{rule.name}</p>
                      <span className="badge-blue">{TYPE_LABELS[rule.type] || rule.type}</span>
                      <span className={STATUS_STYLES[rule.lastStatus] || 'badge-gray'}>{rule.lastStatus || 'idle'}</span>
                      {rule.isDue && <span className="badge-amber">due</span>}
                    </div>
                    <p className="text-app-secondary text-[12px] mt-2">
                      {rule.frequency} · últimos {rule.config?.fromDaysBack || 7} días · {rule.active ? 'activa' : 'pausada'}
                    </p>
                    {rule.config?.notes && <p className="text-app-primary text-[12px] mt-1">{rule.config.notes}</p>}
                    {rule.lastRunAt && (
                      <p className="text-app-secondary text-[11px] mt-2">
                        Última corrida: {new Date(rule.lastRunAt).toLocaleString('es-AR')}
                      </p>
                    )}
                    {rule.lastReport && (
                      <div className="mt-1 space-y-1">
                        <p className="text-app-secondary text-[11px]">
                          Último reporte: {rule.lastReport.titulo}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {rule.lastReport.generationMode && (
                            <span className={rule.lastReport.generationMode === 'ai' ? 'badge-green' : 'badge-amber'}>
                              {rule.lastReport.generationMode === 'ai' ? 'AI real' : 'fallback'}
                            </span>
                          )}
                          {rule.lastReport.provider && <span className="badge-gray">{rule.lastReport.provider}</span>}
                          {rule.lastReport.confidence != null && (
                            <span className="badge-gray">Conf. {(rule.lastReport.confidence * 100).toFixed(0)}%</span>
                          )}
                        </div>
                        {rule.lastReport.qualityNote && (
                          <p className="text-app-secondary text-[11px]">{rule.lastReport.qualityNote}</p>
                        )}
                      </div>
                    )}
                    {rule.lastError && (
                      <p className="text-red-400 text-[11px] mt-1">{rule.lastError}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleRun(rule._id)} disabled={runningId === rule._id} className="btn-primary disabled:opacity-50">
                      {runningId === rule._id ? 'Corriendo...' : 'Ejecutar ahora'}
                    </button>
                    <button onClick={() => handleEdit(rule)} className="btn-secondary">Editar</button>
                    <button onClick={() => handleDelete(rule._id)} className="btn-secondary text-red-300">Eliminar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
