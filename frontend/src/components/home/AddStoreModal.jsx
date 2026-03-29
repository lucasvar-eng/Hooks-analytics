import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function AddStoreModal({ onClose, onCreated }) {
  const navigate = useNavigate();
  const [step, setStep] = useState('name'); // 'name' | 'integrations' | 'done'
  const [nombre, setNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [store, setStore] = useState(null);
  const [connectingTN, setConnectingTN] = useState(false);

  const handleCreate = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.post('/api/stores', { nombre: nombre.trim() });
      setStore(data);
      setStep('integrations');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la tienda');
    }
    setSaving(false);
  };

  const handleConnectTN = async () => {
    if (!store) return;
    setConnectingTN(true);
    try {
      const { data } = await api.get(`/api/tn/connect/${store._id}`);
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err) {
      setError('Error al iniciar conexión con TiendaNube');
      setConnectingTN(false);
    }
  };

  const handleGoToStore = () => {
    onCreated();
    navigate(`/store/${store._id}/dashboard`);
  };

  const handleSkipToStore = () => {
    onCreated();
    navigate(`/store/${store._id}/settings`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {step === 'name' && 'Nueva tienda'}
            {step === 'integrations' && 'Conectar integraciones'}
            {step === 'done' && 'Tienda creada'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Step 1: Name */}
          {step === 'name' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre de la tienda
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Ej: Mi Tienda Online"
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                  autoFocus
                />
                <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                  Podés conectar TiendaNube y Meta Ads en el siguiente paso.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Integrations */}
          {step === 'integrations' && store && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-gray-100">{store.nombre}</span> fue creada. Conectá las integraciones para empezar a ver datos.
              </p>

              {/* TiendaNube */}
              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">TiendaNube</p>
                      <p className="text-xs text-gray-500">Sincroniza ventas, productos y clientes</p>
                    </div>
                  </div>
                  <button
                    onClick={handleConnectTN}
                    disabled={connectingTN}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
                  >
                    {connectingTN ? 'Conectando...' : 'Conectar'}
                  </button>
                </div>
              </div>

              {/* Meta Ads */}
              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Meta Ads</p>
                      <p className="text-xs text-gray-500">Importá datos via CSV desde Ads Manager</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg">
                    Desde Meta Ads
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                Podés configurar integraciones en cualquier momento desde Settings.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          {step === 'name' && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition">
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!nombre.trim() || saving}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {saving ? 'Creando...' : 'Crear tienda'}
              </button>
            </>
          )}
          {step === 'integrations' && (
            <>
              <button onClick={handleSkipToStore} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition">
                Configurar después
              </button>
              <button
                onClick={handleGoToStore}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
              >
                Ir al dashboard
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
