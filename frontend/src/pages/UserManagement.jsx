import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const ROLE_LABELS = { admin: 'Admin', analyst: 'Analista', viewer: 'Visor' };
const ROLE_BADGE = { admin: 'badge-red', analyst: 'badge-blue', viewer: 'badge-gray' };

const EMPTY_FORM = { email: '', password: '', nombre: '', role: 'viewer', storeAccess: [] };

export default function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const { data } = await api.get('/api/admin/users');
      setUsers(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { api.get('/api/stores').then(({ data }) => setStores(data)).catch(() => {}); }, []);

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setFormError(null); setFormSuccess(null); setShowForm(true); };
  const openEdit = (user) => {
    setEditingId(user._id);
    setForm({ email: user.email, password: '', nombre: user.nombre, role: user.role, storeAccess: user.storeAccess?.map((s) => (typeof s === 'object' ? s._id : s)) || [] });
    setFormError(null); setFormSuccess(null); setShowForm(true);
  };
  const cancelForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setFormError(null); setFormSuccess(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setFormError(null); setFormSuccess(null);
    try {
      if (editingId) {
        await api.put(`/api/admin/users/${editingId}`, form);
        setFormSuccess('Usuario actualizado correctamente');
      } else {
        await api.post('/api/admin/users', form);
        setFormSuccess('Usuario creado correctamente');
      }
      await loadUsers();
      if (!editingId) setForm(EMPTY_FORM);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (!confirm(`¿Eliminar al usuario "${user.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/api/admin/users/${user._id}`);
      setUsers((prev) => prev.filter((u) => u._id !== user._id));
      if (editingId === user._id) cancelForm();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar');
    }
  };

  const toggleStore = (storeId) => {
    setForm((prev) => ({
      ...prev,
      storeAccess: prev.storeAccess.includes(storeId)
        ? prev.storeAccess.filter((id) => id !== storeId)
        : [...prev.storeAccess, storeId],
    }));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="bg-[#0f0f0f] border-b border-white/[0.06] px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-[13px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition">
            ← Volver
          </button>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Gestión de Usuarios</p>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-gray-500">
            {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
          </p>
          <button onClick={openCreate} className="btn-primary">+ Nuevo usuario</button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="card p-5 space-y-4">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              {editingId ? 'Editar usuario' : 'Crear usuario'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="kpi-label mb-1 block">Nombre <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="input-dark w-full" placeholder="Nombre completo" />
                </div>
                <div>
                  <label className="kpi-label mb-1 block">Email <span className="text-red-500">*</span></label>
                  <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-dark w-full" placeholder="usuario@ejemplo.com" />
                </div>
                <div>
                  <label className="kpi-label mb-1 block">Contraseña {!editingId && <span className="text-red-500">*</span>}</label>
                  <input type="password" required={!editingId} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input-dark w-full" placeholder={editingId ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'} />
                </div>
                <div>
                  <label className="kpi-label mb-1 block">Rol <span className="text-red-500">*</span></label>
                  <select required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input-dark w-full">
                    <option value="viewer">Visor</option>
                    <option value="analyst">Analista</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="kpi-label mb-2 block">Acceso a tiendas</label>
                {stores.length === 0 ? (
                  <p className="text-[12px] text-gray-600">Sin tiendas disponibles</p>
                ) : (
                  <div className="max-h-32 overflow-y-auto bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-2">
                    {stores.map((s) => (
                      <label key={s._id} className="flex items-center gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={form.storeAccess.includes(s._id)} onChange={() => toggleStore(s._id)} className="w-4 h-4 accent-blue-500" />
                        <span className="text-[13px] text-gray-300">{s.nombre}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {formError && <p className="text-[12px] font-medium text-red-400">{formError}</p>}
              {formSuccess && <p className="text-[12px] font-medium text-emerald-400">{formSuccess}</p>}

              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
                  {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear usuario'}
                </button>
                <button type="button" onClick={cancelForm} className="btn-ghost">Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Users table */}
        <div className="card">
          {loading ? (
            <div className="p-8 text-center text-[13px] text-gray-600">Cargando usuarios...</div>
          ) : error ? (
            <div className="p-8 text-center text-[13px] text-red-400">{error}</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-gray-600">No hay usuarios registrados.</div>
          ) : (
            <table className="w-full table-dark">
              <thead>
                <tr>
                  <th className="text-left">Nombre</th>
                  <th className="text-left">Email</th>
                  <th className="text-left">Rol</th>
                  <th className="text-left">Tiendas</th>
                  <th className="text-left">Fecha</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id}>
                    <td className="font-medium text-white">{user.nombre}</td>
                    <td className="text-[11px]">{user.email}</td>
                    <td>
                      <span className={ROLE_BADGE[user.role] || ROLE_BADGE.viewer}>
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </td>
                    <td>
                      {user.storeAccess?.length > 0 ? (
                        <span title={user.storeAccess.map((s) => s.nombre).join(', ')}>
                          {user.storeAccess.length === 1 ? user.storeAccess[0].nombre : `${user.storeAccess.length} tiendas`}
                        </span>
                      ) : (
                        <span className="text-gray-700 italic">Ninguna</span>
                      )}
                    </td>
                    <td className="text-[11px]">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-AR') : '—'}</td>
                    <td>
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => openEdit(user)} className="text-[11px] text-blue-400 hover:text-blue-300 transition font-medium">Editar</button>
                        <button onClick={() => handleDelete(user)} className="text-[11px] text-red-500 hover:text-red-400 transition font-medium">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}