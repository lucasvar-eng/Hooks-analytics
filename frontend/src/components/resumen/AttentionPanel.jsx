import { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Panel "Atención" estilo inbox de Linear.
 *
 * Props:
 *   alerts: [{ id, severity, source, text, detail?, ctaLabel?, ctaTo? }]
 *     severity: 'danger' | 'warn' | 'info' | 'ok'
 *     detail: jsx opcional para mostrar al expandir (tabla embedded, etc.)
 *     ctaTo: ruta del link interno al detalle completo
 *
 * El primer alert se abre por default si openFirst es true.
 */
export default function AttentionPanel({ alerts = [], openFirst = false, storeId }) {
  const actionable = alerts.filter((a) => a.severity !== 'ok');
  const opportunities = alerts.filter((a) => a.severity === 'ok');

  const [openId, setOpenId] = useState(() => (openFirst && alerts[0] ? alerts[0].id : null));

  if (alerts.length === 0) {
    return (
      <div className="resumen-attention">
        <div className="resumen-attention__header">
          <span className="text-[13px] font-semibold text-white">Atención</span>
          <span className="text-[11px] text-gray-500">Sin alertas pendientes</span>
        </div>
        <div className="px-4 py-6 text-center text-[12px] text-gray-500">
          No hay alertas ni oportunidades. Todo en orden.
        </div>
      </div>
    );
  }

  return (
    <div className="resumen-attention">
      <div className="resumen-attention__header">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-white">Atención</span>
          <span className="text-[11px] text-gray-500">
            {actionable.length} {actionable.length === 1 ? 'requiere acción' : 'requieren acción'}
            {opportunities.length > 0 && ` · ${opportunities.length} ${opportunities.length === 1 ? 'oportunidad' : 'oportunidades'}`}
            {alerts.some((a) => a.detail) && ' · tocá para expandir'}
          </span>
        </div>
      </div>
      <div>
        {alerts.map((alert) => {
          const isOpen = openId === alert.id;
          const expandable = !!alert.detail;
          return (
            <div key={alert.id} className={`resumen-alert-item ${isOpen ? 'is-open' : ''}`}>
              <div
                className="resumen-alert-row"
                onClick={() => expandable && setOpenId(isOpen ? null : alert.id)}
                style={{ cursor: expandable ? 'pointer' : 'default' }}
              >
                <div className={`resumen-alert-icon resumen-alert-icon--${alert.severity}`}>
                  {iconFor(alert.severity)}
                </div>
                <div className="resumen-alert-row__body">
                  <span className="resumen-alert-row__source">{alert.source}</span>
                  <span className="resumen-alert-row__text" dangerouslySetInnerHTML={{ __html: alert.text }} />
                </div>
                {alert.ctaTo && !expandable && (
                  <Link
                    to={alert.ctaTo}
                    onClick={(e) => e.stopPropagation()}
                    className="resumen-alert-row__cta"
                  >
                    {alert.ctaLabel || 'Ver'} →
                  </Link>
                )}
                {expandable && (
                  <svg className="resumen-alert-row__chevron w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </div>
              {isOpen && expandable && (
                <div className="resumen-alert-detail">
                  {alert.detail}
                  {alert.ctaTo && (
                    <div className="resumen-alert-detail__footer">
                      <span className="text-[11px] text-gray-500">{alert.footerNote || ''}</span>
                      <Link
                        to={alert.ctaTo}
                        className="text-[11px] font-semibold bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 px-3 py-1.5 rounded-lg transition"
                      >
                        {alert.ctaLabel || 'Ver detalle completo'} →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function iconFor(severity) {
  switch (severity) {
    case 'danger': return '!';
    case 'warn':   return '?';
    case 'info':   return '⌛';
    case 'ok':     return '+';
    default:       return '·';
  }
}
