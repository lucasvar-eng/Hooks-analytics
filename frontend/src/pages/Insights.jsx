/**
 * Página de Auto-Insights por tienda.
 * Reglas determinísticas — no usa IA, no espera nada.
 * Reemplaza el menú lateral con conclusiones que se sacó cuando se
 * removió la IA interna.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';

const KIND_TITLE = {
  win: 'Wins',
  problem: 'Problemas',
  reminder: 'Para configurar',
};

const SEV_STYLES = {
  critical: { bar: 'bg-red-500', badge: 'bg-red-500/15 text-red-300 border-red-500/25', icon: '✕' },
  warn: { bar: 'bg-amber-400', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/25', icon: '!' },
  info: { bar: 'bg-blue-400', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/25', icon: 'i' },
  good: { bar: 'bg-emerald-400', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', icon: '✓' },
};

function timeAgo(date) {
  if (!date) return '—';
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return 'hace segundos';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  return `hace ${Math.floor(diff / 86400)}d`;
}

function InsightCard({ item }) {
  const sev = SEV_STYLES[item.severity] || SEV_STYLES.info;
  return (
    <div className="card overflow-hidden flex p-0">
      <div className={`w-1 shrink-0 ${sev.bar}`} />
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold border ${sev.badge}`}>
              {sev.icon}
            </span>
            <h3 className="text-white text-[13.5px] font-semibold leading-snug">{item.title}</h3>
          </div>
          {item.metric && (
            <span className="text-[11px] text-app-muted tabular-nums whitespace-nowrap shrink-0">
              {item.metric.label}: <span className="text-app-secondary font-semibold">{item.metric.value}</span>
            </span>
          )}
        </div>
        <p className="text-[12.5px] text-app-secondary leading-relaxed">{item.detail}</p>
        {item.link && item.cta && (
          <Link
            to={item.link}
            className="inline-block mt-3 px-2.5 py-1 text-[11px] font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-white rounded transition"
          >
            {item.cta} →
          </Link>
        )}
      </div>
    </div>
  );
}

export default function Insights() {
  const { storeId } = useParams();
  const { from, to } = useSelector((s) => s.date);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!storeId || !from || !to) return;
    setRefreshing(true);
    try {
      const { data: insights } = await api.get(
        `/api/stores/${storeId}/auto-insights`,
        { params: { from, to } }
      );
      setData(insights);
    } catch {
      setData(null);
    }
    setLoading(false);
    setRefreshing(false);
  }, [storeId, from, to]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="text-center py-12 text-[13px] text-app-secondary">Generando insights…</div>;
  }
  if (!data) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px] text-app-secondary">No se pudieron generar los insights.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Insights automáticos</h1>
          <p className="page-subtitle">
            Wins, problemas y configuración pendiente — recalculado cada vez que abrís la página.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-app-muted">Actualizado {timeAgo(data.generatedAt)}</span>
          <button
            onClick={load}
            disabled={refreshing}
            className="btn-primary text-[12px] disabled:opacity-50"
          >
            {refreshing ? 'Recalculando…' : '↻ Refrescar'}
          </button>
        </div>
      </div>

      {/* Stats top */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <p className="text-emerald-300 text-[24px] font-bold tabular-nums">{data.counts.wins}</p>
          <p className="text-app-muted text-[11px] uppercase tracking-wide">Wins</p>
        </div>
        <div className="card p-3 text-center">
          <p className={`text-[24px] font-bold tabular-nums ${data.counts.problems > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
            {data.counts.problems}
          </p>
          <p className="text-app-muted text-[11px] uppercase tracking-wide">Problemas</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-blue-300 text-[24px] font-bold tabular-nums">{data.counts.reminders}</p>
          <p className="text-app-muted text-[11px] uppercase tracking-wide">Para configurar</p>
        </div>
      </div>

      {/* Problemas primero (más urgente) */}
      {data.problems.length > 0 && (
        <div>
          <h2 className="text-white text-[14px] font-bold mb-3 uppercase tracking-wider">
            {KIND_TITLE.problem} ({data.problems.length})
          </h2>
          <div className="space-y-2">
            {data.problems.map((p) => (
              <InsightCard key={p.id} item={p} />
            ))}
          </div>
        </div>
      )}

      {data.wins.length > 0 && (
        <div>
          <h2 className="text-emerald-300 text-[14px] font-bold mb-3 uppercase tracking-wider">
            {KIND_TITLE.win} ({data.wins.length})
          </h2>
          <div className="space-y-2">
            {data.wins.map((w) => (
              <InsightCard key={w.id} item={w} />
            ))}
          </div>
        </div>
      )}

      {data.reminders.length > 0 && (
        <div>
          <h2 className="text-blue-300 text-[14px] font-bold mb-3 uppercase tracking-wider">
            {KIND_TITLE.reminder} ({data.reminders.length})
          </h2>
          <div className="space-y-2">
            {data.reminders.map((r) => (
              <InsightCard key={r.id} item={r} />
            ))}
          </div>
        </div>
      )}

      {data.problems.length === 0 && data.wins.length === 0 && data.reminders.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-[13px] text-app-secondary">Todo bien — no hay insights destacados en este período.</p>
        </div>
      )}
    </div>
  );
}
