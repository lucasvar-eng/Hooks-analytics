import { useMemo } from 'react';
import { SEGMENTS } from './segmentsCatalog';

/**
 * Dos cards de acciones recomendadas:
 *  - En riesgo recuperar: top N de segmento at_risk ordenados por gasto histórico.
 *  - Mejores premiar: top N de segmento champions ordenados por gasto histórico.
 *
 * Recibe la lista completa de clientes; deriva en cliente. CTA implícito en el copy.
 */
function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}
function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '—';
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}
function fmtNum(v) {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('es-AR');
}
function initialsOf(name, email) {
  const src = name || (email ? email.split('@')[0] : '');
  if (!src) return '?';
  const parts = src.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function SegmentActionCard({ segmentId, title, sub, customers, onCustomerClick, limit = 5 }) {
  const seg = SEGMENTS[segmentId];
  const accentColor = seg.color;

  const filtered = useMemo(() => {
    return (customers || [])
      .filter((c) => c.rfmSegment === segmentId)
      .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
  }, [customers, segmentId]);

  const totalCount = filtered.length;
  const totalRevenue = filtered.reduce((acc, c) => acc + (c.totalSpent || 0), 0);
  const rows = filtered.slice(0, limit);

  return (
    <div className="card p-5">
      <div className="flex justify-between items-start mb-2 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${seg.badgeClass}`}>
              {seg.label}
            </span>
            <p className="text-[10px] font-bold uppercase tracking-[1.3px] text-gray-300">{title}</p>
          </div>
          <p className="text-[12px] text-gray-200 leading-snug">{sub}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[22px] font-bold tabular-nums leading-none" style={{ color: accentColor }}>
            {fmtMoneyShort(totalRevenue)}
          </p>
          <p className="text-[11px] text-gray-300 mt-1">{fmtNum(totalCount)} clientes</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-gray-200 text-[12px] py-4 text-center">No hay clientes en este segmento.</p>
      ) : (
        <div className="mt-4">
          {rows.map((c, idx) => {
            const isLast = idx === rows.length - 1;
            return (
              <button
                type="button"
                key={c._id}
                onClick={() => onCustomerClick?.(c)}
                className={`w-full flex items-center gap-3 text-left py-2.5 ${isLast ? '' : 'border-b border-white/[0.03]'}
                  hover:bg-white/[0.02] -mx-2 px-2 rounded-md transition`}
              >
                <span className="w-8 h-8 rounded-full bg-white/[0.06] text-gray-200 text-[12px] font-bold inline-flex items-center justify-center flex-shrink-0">
                  {initialsOf(c.name, c.email)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] text-white font-medium truncate">{c.name || c.email}</p>
                  <p className="text-[11px] text-gray-300 mt-0.5">
                    {c.totalOrders} {c.totalOrders === 1 ? 'compra' : 'compras'}
                    {c.recency != null && <> · hace {c.recency}d</>}
                    {c.rfmScore && <> · score {c.rfmScore}</>}
                  </p>
                </div>
                <span className="text-[12.5px] font-bold tabular-nums flex-shrink-0" style={{ color: accentColor }}>
                  {fmtMoneyShort(c.totalSpent)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AtRiskActionCard({ customers, onCustomerClick }) {
  return (
    <SegmentActionCard
      segmentId="at_risk"
      title="Recuperar urgente"
      sub="Top 5 con más gasto histórico — compraban seguido y se fueron. Mandales algo personalizado."
      customers={customers}
      onCustomerClick={onCustomerClick}
    />
  );
}

export function ChampionsActionCard({ customers, onCustomerClick }) {
  return (
    <SegmentActionCard
      segmentId="champions"
      title="Premiar y fidelizar"
      sub="Top 5 de tus mejores — programa VIP, acceso anticipado, referidos. No los pierdas."
      customers={customers}
      onCustomerClick={onCustomerClick}
    />
  );
}

export default function ActionCards({ customers, onCustomerClick }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <AtRiskActionCard customers={customers} onCustomerClick={onCustomerClick} />
      <ChampionsActionCard customers={customers} onCustomerClick={onCustomerClick} />
    </div>
  );
}
