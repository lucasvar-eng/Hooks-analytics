import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

const TABS = [
  { key: 'active', label: 'Activas' },
  { key: 'acknowledged', label: 'Reconocidas' },
  { key: 'resolved', label: 'Resueltas' },
];

const SEVERITY_STYLES = {
  critical: { bar: 'bg-red-500', badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  warning: { bar: 'bg-yellow-500', badge: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' },
  info: { bar: 'bg-blue-500', badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
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

  const handleAction = async (alertId, action) => {
    try {
      await api.put(`/api/stores/${storeId}/alerts/${alertId}/${action}`);
      fetchAlerts();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Alertas</h2>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Cargando alertas...</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">
            {tab === 'active' ? 'No hay alertas activas. Todo en orden.' : `No hay alertas ${TABS.find((t) => t.key === tab)?.label.toLowerCase()}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const sev = SEVERITY_STYLES[alert.severidad] || SEVERITY_STYLES.info;
            return (
              <div
                key={alert._id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex"
              >
                {/* Severity bar */}
                <div className={`w-1.5 shrink-0 ${sev.bar}`} />

                <div className="flex-1 p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {alert.titulo}
                      </h3>
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${sev.badge}`}>
                        {alert.severidad}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        {TIPO_LABELS[alert.tipo] || alert.tipo}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(alert.fechaDetectada).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Description */}
                  {alert.descripcion && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {alert.descripcion}
                    </p>
                  )}

                  {/* Actions */}
                  {tab === 'active' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(alert._id, 'acknowledge')}
                        className="px-3 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                      >
                        Reconocer
                      </button>
                      <button
                        onClick={() => handleAction(alert._id, 'resolve')}
                        className="px-3 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-800/30 transition"
                      >
                        Resolver
                      </button>
                    </div>
                  )}
                  {tab === 'acknowledged' && (
                    <button
                      onClick={() => handleAction(alert._id, 'resolve')}
                      className="px-3 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-800/30 transition"
                    >
                      Resolver
                    </button>
                  )}
                  {tab === 'resolved' && alert.resolvedAt && (
                    <p className="text-xs text-gray-400">
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
