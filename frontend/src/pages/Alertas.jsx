import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

const TABS = [
  { key: 'active', label: 'Activas' },
  { key: 'acknowledged', label: 'Reconocidas' },
  { key: 'resolved', label: 'Resueltas' },
];

const SEVERITY_STYLES = {
  critical: { bar: 'bg-red-500', badge: 'badge-red' },
  warning: { bar: 'bg-amber-500', badge: 'badge-amber' },
  info: { bar: 'bg-blue-500', badge: 'badge-blue' },
};

const TIPO_LABELS = {
  performance: 'Rendimiento',
  anomaly: 'Anomalía',
  threshold: 'Umbral',
  system: 'Sistema',
};

export default function Alertas() {
  const { storeId } = useParams();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');
  const [store, setStore] = useState(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/stores/${storeId}/alerts`, { params: { estado: tab } });
      setAlerts(data);
    } catch {
      setAlerts([]);
    }
    setLoading(false);
  }, [storeId, tab]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  useEffect(() => {
    api.get(`/api/stores/${storeId}`).then(({ data }) => setStore(data)).catch(() => setStore(null));
  }, [storeId]);

  const handleAction = async (alertId, action) => {
    try {
      await api.put(`/api/stores/${storeId}/alerts/${alertId}/${action}`);
      fetchAlerts();
    } catch {
      // ignore
    }
  };

  const runNow = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const { data } = await api.post(`/api/stores/${storeId}/alerts/run`);
      setRunResult({
        ok: true,
        message: data.created > 0
          ? `Diagnóstico corrido. Se detectaron ${data.detected} alertas (${data.created} nuevas).`
          : data.hasKpis
            ? 'Diagnóstico corrido. Sin alertas — todo en orden.'
            : 'Diagnóstico corrido. Sin alertas detectadas. Cargá objetivos para activar más chequeos.',
      });
      await fetchAlerts();
    } catch (err) {
      setRunResult({ ok: false, message: err.response?.data?.error || 'Error al correr el diagnóstico' });
    }
    setRunning(false);
  };

  const hasKpis = !!(
    store?.objetivos?.kpis &&
    Object.values(store.objetivos.kpis).some((v) => v != null && v !== 0)
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Alertas</h1>
          <p className="page-subtitle">Monitoreo de umbrales y anomalías. Se chequea cada 6 horas — usá "Correr ahora" para forzar.</p>
        </div>
        <button
          onClick={runNow}
          disabled={running}
          className="btn-primary disabled:opacity-50 text-[12px]"
        >
          {running ? 'Corriendo…' : '↻ Correr diagnóstico ahora'}
        </button>
      </div>

      {runResult && (
        <div
          className={`rounded-lg border p-3 text-[12.5px] ${
            runResult.ok
              ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200'
              : 'border-red-500/20 bg-red-500/[0.06] text-red-200'
          }`}
        >
          {runResult.message}
        </div>
      )}

      {!hasKpis && store && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3 flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-amber-200">Sin objetivos cargados</p>
            <p className="text-[12px] text-amber-100/80 mt-1">
              Esta tienda no tiene KPIs target configurados. Anomalías (caídas de revenue, picos de spend, ROAS negativo) siguen detectándose, pero los chequeos contra target (ROAS, CPA, margen) no se disparan hasta que cargues objetivos.
            </p>
          </div>
          <Link
            to={`/store/${storeId}/settings`}
            className="text-[12px] font-medium px-3 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 transition whitespace-nowrap"
          >
            Configurar objetivos
          </Link>
        </div>
      )}

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

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-[13px] text-gray-600">Cargando alertas...</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[13px] text-gray-600">
            {tab === 'active' ? 'No hay alertas activas. Todo en orden.' : `No hay alertas ${TABS.find((t) => t.key === tab)?.label.toLowerCase()}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const sev = SEVERITY_STYLES[alert.severidad] || SEVERITY_STYLES.info;
            return (
              <div
                key={alert._id}
                className="card overflow-hidden flex p-0"
              >
                {/* Severity bar */}
                <div className={`w-1 shrink-0 ${sev.bar}`} />

                <div className="flex-1 p-3.5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[13px] font-semibold text-white">
                        {alert.titulo}
                      </h3>
                      <span className={sev.badge}>
                        {alert.severidad?.toUpperCase()}
                      </span>
                      <span className="badge-gray">
                        {TIPO_LABELS[alert.tipo] || alert.tipo}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-600 whitespace-nowrap">
                      {new Date(alert.fechaDetectada).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Description */}
                  {alert.descripcion && (
                    <p className="text-[12px] text-gray-500 mb-2.5 leading-relaxed">
                      {alert.descripcion}
                    </p>
                  )}

                  {/* Actions */}
                  {tab === 'active' && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleAction(alert._id, 'acknowledge')}
                        className="btn-ghost text-[11px] py-1 px-2.5"
                      >
                        Reconocer
                      </button>
                      <button
                        onClick={() => handleAction(alert._id, 'resolve')}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition"
                      >
                        Resolver
                      </button>
                    </div>
                  )}
                  {tab === 'acknowledged' && (
                    <button
                      onClick={() => handleAction(alert._id, 'resolve')}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition"
                    >
                      Resolver
                    </button>
                  )}
                  {tab === 'resolved' && alert.resolvedAt && (
                    <p className="text-[11px] text-gray-600">
                      Resuelto: {new Date(alert.resolvedAt).toLocaleString('es-AR')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}