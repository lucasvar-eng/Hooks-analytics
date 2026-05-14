import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', help: 'Todo menos eliminar la tienda' },
  { value: 'editor', label: 'Editor', help: 'Lee + modifica config no sensible' },
  { value: 'viewer', label: 'Viewer', help: 'Solo lectura' },
];

const ROLE_LABELS = {
  owner: { label: 'Owner', color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  admin: { label: 'Admin', color: 'text-blue-300', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  editor: { label: 'Editor', color: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  viewer: { label: 'Viewer', color: 'text-gray-300', bg: 'bg-white/[0.04]', border: 'border-white/[0.08]' },
};

function fmtDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function RoleChip({ role }) {
  const cfg = ROLE_LABELS[role] || ROLE_LABELS.viewer;
  return (
    <span className={`text-[11px] font-medium px-2 py-1 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

export default function Team() {
  const { storeId } = useParams();
  const { user } = useAuth();
  const [team, setTeam] = useState({ members: [], invitations: [] });
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [updatingMember, setUpdatingMember] = useState(null);
  const [updatingInv, setUpdatingInv] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/stores/${storeId}/team`);
      setTeam(data);
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.error || 'No se pudo cargar el equipo' });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (storeId) load();
  }, [storeId]);

  const myAccess = useMemo(() => {
    if (user?.role === 'admin') return { isGlobalAdmin: true, role: 'owner', canInvite: true, canManage: true };
    const mine = team.members.find((m) => String(m.userId) === String(user?.id));
    const role = mine?.role || 'viewer';
    const canInvite = ['owner', 'admin'].includes(role);
    const canManage = ['owner', 'admin'].includes(role);
    return { isGlobalAdmin: false, role, canInvite, canManage };
  }, [team.members, user]);

  const handleInvite = async (e) => {
    e?.preventDefault?.();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setMsg(null);
    try {
      const { data } = await api.post(`/api/stores/${storeId}/team/invitations`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteEmail('');
      setInviteRole('viewer');
      if (data.emailSent) {
        setMsg({ ok: true, text: `Invitación enviada por mail a ${data.invitation.email}` });
      } else if (data.emailError === 'email_disabled') {
        const link = `${window.location.origin}${data.acceptUrl}`;
        setMsg({
          ok: true,
          text: `Invitación creada (email service deshabilitado). Compartile este link: ${link}`,
        });
      } else {
        setMsg({
          ok: true,
          text: `Invitación creada, pero no se pudo enviar el mail: ${data.emailError}`,
        });
      }
      await load();
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.error || 'No se pudo invitar' });
    }
    setInviting(false);
  };

  const handleChangeRole = async (member, newRole) => {
    if (newRole === member.role) return;
    setUpdatingMember(member.userId);
    setMsg(null);
    try {
      await api.put(`/api/stores/${storeId}/team/members/${member.userId}`, { role: newRole });
      await load();
      setMsg({ ok: true, text: `Rol actualizado a ${newRole}` });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.error || 'No se pudo cambiar el rol' });
    }
    setUpdatingMember(null);
  };

  const handleRemoveMember = async (member) => {
    if (!confirm(`¿Quitar a ${member.email} del equipo de esta tienda?`)) return;
    setUpdatingMember(member.userId);
    setMsg(null);
    try {
      await api.delete(`/api/stores/${storeId}/team/members/${member.userId}`);
      await load();
      setMsg({ ok: true, text: `${member.email} fue removido del equipo` });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.error || 'No se pudo remover' });
    }
    setUpdatingMember(null);
  };

  const handleRevokeInvitation = async (inv) => {
    if (!confirm(`¿Revocar la invitación a ${inv.email}?`)) return;
    setUpdatingInv(inv._id);
    setMsg(null);
    try {
      await api.delete(`/api/stores/${storeId}/team/invitations/${inv._id}`);
      await load();
      setMsg({ ok: true, text: 'Invitación revocada' });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.error || 'No se pudo revocar' });
    }
    setUpdatingInv(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">
      <header>
        <h1 className="text-white text-[22px] font-bold">Equipo de la tienda</h1>
        <p className="text-app-secondary text-[13px] mt-1">
          Invitá miembros, gestioná roles y revisá quién tiene acceso a esta tienda.
        </p>
      </header>

      {msg && (
        <div
          className={`rounded-lg border p-3 text-[12.5px] ${
            msg.ok
              ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200'
              : 'border-red-500/20 bg-red-500/[0.06] text-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Invitar */}
      {myAccess.canInvite && (
        <div className="card p-5">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Invitar miembro</p>
          <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3 items-end">
            <div>
              <label className="kpi-label mb-1 block">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="persona@empresa.com"
                className="input-dark w-full"
                required
              />
            </div>
            <div>
              <label className="kpi-label mb-1 block">Rol</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="input-dark w-full"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label} — {opt.help}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="btn-primary disabled:opacity-50 h-[38px]"
            >
              {inviting ? 'Enviando…' : 'Enviar invitación'}
            </button>
          </form>
          <p className="text-[11px] text-gray-600 mt-3">
            La invitación expira en 7 días. Si el email service no está configurado, te devolvemos el link para que lo compartas a mano.
          </p>
        </div>
      )}

      {/* Invitaciones pendientes */}
      {team.invitations?.length > 0 && (
        <div className="card p-5">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Invitaciones pendientes ({team.invitations.length})
          </p>
          <div className="space-y-2">
            {team.invitations.map((inv) => (
              <div key={inv._id} className="flex items-center justify-between gap-3 py-2.5 px-3 bg-white/[0.02] rounded-lg border border-white/[0.05]">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-white font-medium truncate">{inv.email}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Invitado por {inv.invitedBy?.nombre || inv.invitedBy?.email || '—'} · vence {fmtDate(inv.expiresAt)}
                  </p>
                </div>
                <RoleChip role={inv.role} />
                {myAccess.canInvite && (
                  <button
                    onClick={() => handleRevokeInvitation(inv)}
                    disabled={updatingInv === inv._id}
                    className="text-[11px] text-red-400 hover:text-red-300 transition disabled:opacity-50"
                  >
                    {updatingInv === inv._id ? '…' : 'Revocar'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Miembros */}
      <div className="card p-5">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Miembros ({team.members?.length || 0})
        </p>
        {loading ? (
          <p className="text-[12px] text-gray-600">Cargando…</p>
        ) : team.members?.length === 0 ? (
          <p className="text-[12px] text-gray-600">Esta tienda todavía no tiene miembros asignados.</p>
        ) : (
          <div className="space-y-2">
            {team.members.map((member) => {
              const isMe = String(member.userId) === String(user?.id);
              const isOwner = member.role === 'owner';
              return (
                <div
                  key={member._id}
                  className="flex items-center justify-between gap-3 py-2.5 px-3 bg-white/[0.02] rounded-lg border border-white/[0.05]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-white font-medium truncate">
                      {member.nombre || member.email}
                      {isMe && <span className="ml-2 text-[10px] text-blue-300">(vos)</span>}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5 truncate">{member.email}</p>
                    {member.acceptedAt && (
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        Acceso desde {fmtDate(member.acceptedAt)}
                      </p>
                    )}
                  </div>

                  {myAccess.canManage && !isOwner && !isMe ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleChangeRole(member, e.target.value)}
                      disabled={updatingMember === member.userId}
                      className="input-dark text-[12px] py-1 px-2 h-auto"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <RoleChip role={member.role} />
                  )}

                  {myAccess.canManage && !isOwner && !isMe && (
                    <button
                      onClick={() => handleRemoveMember(member)}
                      disabled={updatingMember === member.userId}
                      className="text-[11px] text-red-400 hover:text-red-300 transition disabled:opacity-50"
                    >
                      {updatingMember === member.userId ? '…' : 'Quitar'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!myAccess.canInvite && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[12px] text-app-secondary">
            Tu rol actual ({ROLE_LABELS[myAccess.role]?.label || myAccess.role}) no te permite invitar ni gestionar miembros. Si necesitás ese permiso, pedile al owner que te lo asigne.
          </p>
        </div>
      )}
    </div>
  );
}
