import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const ROLE_LABELS = {
  admin: 'Admin',
  analyst: 'Analista',
  viewer: 'Visor',
};

const ROLE_BADGE = {
  admin: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  analyst: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  viewer: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
};

const EMPTY_FORM = {
  email: '',
  password: '',
  nombre: '',
  role: 'viewer',
  storeAccess: [],
};

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
      setLoading(true);
      setError(null);
      const { data } = await api.get('/api/admin/users');
      setUsers(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    api.get('/api/stores').then(({ data }) => setStores(data)).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormSuccess(null);
    setShowForm(true);
  };

  const openEdit = (user) => {
    setEditingId(user._id);
    setForm({
      email: user.email,
      password: '',
      nombre: user.nombre,
      role: user.role,
      storeAccess: user.storeAccess?.map((s) => (typeof s === 'object' ? s._id : s)) || [],
    });
    setFormError(null);
    setFormSuccess(null);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormSuccess(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      if (editingId) {
        await api.put(`/api/admin/users/${editingId}`, form);
        setFormSuccess('Usuario actualizado correctamente');
      } else {
        await api.post('/api/admin/users', form);
        setFormSuccess('Usuario creado correctamente');
      }
      await loadUsers();
      if (!editingId) {
        setForm(EMPTY_FORM);
      }
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            &larr; Volver
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Gestión de Usuarios
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition"
          >
            + Nuevo usuario
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase">
              {editingId ? 'Editar usuario' : 'Crear usuario'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nombre */}
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-sm border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Nombre completo"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-sm border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="usuario@ejemplo.com"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Contraseña {!editingId && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="password"
                    required={!editingId}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-sm border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder={editingId ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'}
                  />
                </div>

                {/* Rol */}
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Rol <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-sm border rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="viewer">Visor</option>
                    <option value="analyst">Analista</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {/* Tiendas */}
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Acceso a tiendas
                </label>
                {stores.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Sin tiendas disponibles</p>
                ) : (
                  <div className="mt-1 max-h-32 overflow-y-auto border rounded p-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700">
                    {stores.map((s) => (
                      <label
                        key={s._id}
                        className="flex items-center gap-2 py-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.storeAccess.includes(s._id)}
                          onChange={() => toggleStore(s._id)}
                          className="accent-indigo-600"
                        />
                        {s.nombre}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Feedback */}
              {formError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{formError}</p>
              )}
              {formSuccess && (
                <p className="text-xs font-medium text-green-600 dark:text-green-400">{formSuccess}</p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded transition"
                >
                  {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear usuario'}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
              Cargando usuarios...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-red-500 dark:text-red-400">{error}</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
              No hay usuarios registrados.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tiendas
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {users.map((user) => (
                  <tr
                    key={user._id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {user.nombre}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          ROLE_BADGE[user.role] || ROLE_BADGE.viewer
                        }`}
                      >
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {user.storeAccess?.length > 0 ? (
                        <span title={user.storeAccess.map((s) => s.nombre).join(', ')}>
                          {user.storeAccess.length === 1
                            ? user.storeAccess[0].nombre
                            : `${user.storeAccess.length} tiendas`}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 italic">Ninguna</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString('es-AR')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => openEdit(user)}
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="text-xs text-red-500 dark:text-red-400 hover:underline font-medium"
                        >
                          Eliminar
                        </button>
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
