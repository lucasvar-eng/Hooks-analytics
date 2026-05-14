import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../services/api';

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

function relativeFromNow(date) {
  if (!date) return '';
  const diff = new Date(date).getTime() - Date.now();
  const absDiff = Math.abs(diff);
  const min = Math.floor(absDiff / 60000);
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (diff > 0) {
    if (d > 0) return `vence en ${d}d`;
    if (h > 0) return `vence en ${h}h`;
    return `vence en ${min} min`;
  }
  if (d > 0) return `hace ${d}d`;
  if (h > 0) return `hace ${h}h`;
  if (min > 0) return `hace ${min} min`;
  return 'recién';
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({});
  const [invites, setInvites] = useState([]);
  const [accepting, setAccepting] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const stores = useSelector((state) => state.stores.stores || []);

  const storeById = useMemo(() => {
    const map = new Map();
    for (const s of stores) map.set(String(s._id), s);
    return map;
  }, [stores]);

  const load = async () => {
    try {
      const [{ data: countsData }, { data: invitesData }] = await Promise.all([
        api.get('/api/alerts/active-counts'),
        api.get('/api/invitations/mine'),
      ]);
      setCounts(countsData || {});
      setInvites(Array.isArray(invitesData) ? invitesData : []);
    } catch {
      // silencioso — el badge desaparece si falla
    }
  };

  useEffect(() => {
    load();
    const tick = setInterval(load, 60_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const alertEntries = useMemo(() => {
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([storeId, count]) => ({
        storeId,
        count,
        store: storeById.get(String(storeId)),
      }))
      .sort((a, b) => b.count - a.count);
  }, [counts, storeById]);

  const totalAlerts = alertEntries.reduce((sum, e) => sum + e.count, 0);
  const totalCount = totalAlerts + invites.length;

  const acceptInvite = async (token, invId) => {
    if (accepting) return;
    setAccepting(invId);
    try {
      const { data } = await api.post('/api/invitations/accept', { token });
      setInvites((prev) => prev.filter((i) => i._id !== invId));
      if (data?.storeId) navigate(`/store/${data.storeId}/dashboard`);
      await load();
      setOpen(false);
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo aceptar la invitación');
    } finally {
      setAccepting(null);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="header-icon-button relative"
        title="Notificaciones"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold text-white bg-red-500 rounded-full">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[340px] rounded-xl border border-white/[0.08] bg-[var(--bg-surface)] shadow-2xl shadow-black/50">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Notificaciones</p>
            <p className="text-[11px] text-gray-600 mt-0.5">
              {totalCount === 0 ? 'Sin novedades' : `${totalCount} pendiente${totalCount === 1 ? '' : 's'}`}
            </p>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {invites.length > 0 && (
              <div className="px-4 py-3 border-b border-white/[0.06]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300 mb-2">Invitaciones</p>
                <div className="space-y-2">
                  {invites.map((inv) => (
                    <div key={inv._id} className="rounded-lg border border-blue-500/15 bg-blue-500/[0.04] p-2.5">
                      <div className="flex items-start gap-2.5">
                        {inv.store?.logoUrl ? (
                          <img src={inv.store.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover border border-white/[0.08]" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[10px] font-bold text-gray-300">
                            {(inv.store?.nombre || '?').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium text-white truncate">{inv.store?.nombre || 'Tienda'}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {inv.invitedBy?.nombre || inv.invitedBy?.email || 'Alguien'} te invitó como <span className="text-blue-300 font-medium">{ROLE_LABELS[inv.role] || inv.role}</span>
                          </p>
                          <p className="text-[10px] text-gray-600 mt-1">{relativeFromNow(inv.expiresAt)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => acceptInvite(inv.token, inv._id)}
                        disabled={accepting === inv._id}
                        className="mt-2 w-full text-[11px] font-medium px-2 py-1.5 rounded-md bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 transition disabled:opacity-50"
                      >
                        {accepting === inv._id ? 'Aceptando…' : 'Aceptar invitación'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {alertEntries.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300 mb-2">Alertas activas</p>
                <div className="space-y-1">
                  {alertEntries.map(({ storeId, count, store }) => (
                    <button
                      key={storeId}
                      onClick={() => {
                        navigate(`/store/${storeId}/alertas`);
                        setOpen(false);
                      }}
                      className="w-full flex items-center justify-between py-2 px-2 rounded-md hover:bg-white/[0.04] transition group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {store?.logoUrl ? (
                          <img src={store.logoUrl} alt="" className="w-6 h-6 rounded-md object-cover border border-white/[0.08]" />
                        ) : (
                          <div className="w-6 h-6 rounded-md bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[9px] font-bold text-gray-300">
                            {(store?.nombre || '?').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="text-[12px] text-gray-300 group-hover:text-white truncate">{store?.nombre || 'Tienda'}</span>
                      </div>
                      <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 text-[10px] font-bold text-white bg-amber-500 rounded-full shrink-0">
                        {count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {totalCount === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-[12px] text-gray-600">No tenés alertas ni invitaciones pendientes.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
