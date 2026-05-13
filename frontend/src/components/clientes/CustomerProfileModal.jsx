import { useEffect } from 'react';
import { getSegment } from './segmentsCatalog';

/**
 * Modal de perfil del cliente — drill-down al click en una fila o action card.
 *
 * Muestra el detalle disponible: contacto, score RFM, métricas, recomendación de
 * acción según segmento. (Las órdenes detalladas viven en otro endpoint que aún no
 * existe — se puede agregar después.)
 */
function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}
function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function initialsOf(name, email) {
  const src = name || (email ? email.split('@')[0] : '');
  if (!src) return '?';
  const parts = src.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default function CustomerProfileModal({ customer, onClose }) {
  useEffect(() => {
    if (!customer) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [customer, onClose]);

  if (!customer) return null;

  const seg = getSegment(customer.rfmSegment);
  const avgTicket = customer.totalOrders ? (customer.totalSpent || 0) / customer.totalOrders : 0;
  const rfmParts = (customer.rfmScore || '').split('-');

  return (
    <div
      className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-[#131316] border border-white/[0.08] rounded-2xl max-w-[640px] w-full max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 px-7 py-5 border-b border-white/[0.06]">
          <span className="w-12 h-12 rounded-full bg-blue-500/15 text-blue-300 text-[15px] font-bold inline-flex items-center justify-center flex-shrink-0">
            {initialsOf(customer.name, customer.email)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[18px] font-bold text-white truncate">{customer.name || 'Sin nombre'}</p>
            <p className="text-[12.5px] text-gray-200 truncate mt-0.5">{customer.email}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${seg.badgeClass}`}>
                {seg.label}
              </span>
              {customer.rfmScore && (
                <span className="font-mono text-[11.5px] text-gray-200 bg-white/[0.04] px-1.5 py-0.5 rounded">
                  Score {customer.rfmScore}
                </span>
              )}
              {customer.cohortMonth && (
                <span className="text-[11.5px] text-gray-300">Alta: {customer.cohortMonth}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-white/[0.04] border border-white/[0.08] w-8 h-8 rounded-full text-white text-[16px] hover:bg-white/[0.1] transition flex-shrink-0"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Métricas */}
        <div className="px-7 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-gray-300 mb-3">Resumen</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Metric label="Compras" value={customer.totalOrders || 0} sub="órdenes totales" />
            <Metric label="Gasto total" value={fmtMoney(customer.totalSpent)} sub="LTV histórico" />
            <Metric label="Ticket promedio" value={fmtMoney(avgTicket)} sub="por compra" />
            <Metric label="Días sin comprar" value={customer.recency != null ? `${customer.recency}d` : '—'} sub="recencia" />
            <Metric label="Primera compra" value={fmtDate(customer.firstPurchase)} sub={null} />
            <Metric label="Última compra" value={fmtDate(customer.lastOrderDate)} sub={null} />
            {customer.firstToSecondOrderLag != null && (
              <Metric label="Demora 2da" value={`${customer.firstToSecondOrderLag}d`} sub="entre 1ra y 2da" />
            )}
            {customer.repurchaseRate != null && (customer.totalOrders || 0) > 1 && (
              <Metric label="Tasa de recompra" value={`${Number(customer.repurchaseRate).toFixed(0)}%`} sub="del cliente" />
            )}
          </div>

          {rfmParts.length === 3 && (
            <div className="mt-5 grid grid-cols-3 gap-3">
              <RfmTile letter="R" name="Recencia" score={rfmParts[0]} />
              <RfmTile letter="F" name="Frecuencia" score={rfmParts[1]} />
              <RfmTile letter="M" name="Monto" score={rfmParts[2]} />
            </div>
          )}

          {seg.action && (
            <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-blue-300">Acción sugerida · {seg.label}</p>
              <p className="text-[12.5px] text-gray-100 mt-1.5 leading-relaxed">{seg.action}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub }) {
  return (
    <div className="rounded-lg bg-white/[0.025] border border-white/[0.06] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-gray-300">{label}</p>
      <p className="text-[18px] font-bold text-white mt-1 leading-none tabular-nums">{value}</p>
      {sub && <p className="text-[10.5px] text-gray-300 mt-1">{sub}</p>}
    </div>
  );
}

function RfmTile({ letter, name, score }) {
  const n = Number(score);
  const color = n >= 4 ? 'text-emerald-400' : n >= 3 ? 'text-blue-300' : n >= 2 ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="rounded-lg bg-white/[0.025] border border-white/[0.06] p-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-gray-300">{letter} · {name}</p>
      <p className={`text-[26px] font-bold mt-1 leading-none ${color}`}>{score}</p>
      <p className="text-[10px] text-gray-300 mt-1">de 5</p>
    </div>
  );
}
