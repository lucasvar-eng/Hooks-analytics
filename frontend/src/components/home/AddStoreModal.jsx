import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function AddStoreModal({ onClose, onCreated }) {
  const navigate = useNavigate();
  const [step, setStep] = useState('name'); // 'name' | 'integrations'
  const [nombre, setNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [store, setStore] = useState(null);

  // TN manual fields
  const [tnToken, setTnToken] = useState('');
  const [tnStoreId, setTnStoreId] = useState('');
  const [connectingTN, setConnectingTN] = useState(false);
  const [tnConnected, setTnConnected] = useState(false);
  const [tnMessage, setTnMessage] = useState(null);

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

  const handleConnectTNManual = async () => {
    if (!store || !tnToken.trim() || !tnStoreId.trim()) return;
    setConnectingTN(true);
    setError(null);
    setTnMessage(null);
    try {
      const { data } = await api.post(`/api/stores/${store._id}/connect-tn-manual`, {
        tnAccessToken: tnToken.trim(),
        tnStoreId: tnStoreId.trim(),
      });
      setTnConnected(true);
      setTnMessage(data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al conectar TiendaNube');
    }
    setConnectingTN(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#161616] border border-white/[0.08] rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-[15px] font-semibold text-white">
            {step === 'name' ? 'Nueva tienda' : 'Conectar integraciones'}
          </h3>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">
              {error}
            </div>
          )}

          {/* Step 1: Name */}
          {step === 'name' && (
            <div className="space-y-4">
              <div>
                <label className="kpi-label mb-1.5 block">Nombre de la tienda</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Ej: Mi Tienda Online"
                  className="input-dark w-full"
                  autoFocus
                />
                <p className="mt-1.5 text-[11px] text-gray-600">
                  Podés conectar TiendaNube y Meta Ads en el siguiente paso.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Integrations */}
          {step === 'integrations' && store && (
            <div className="space-y-4">
              <p className="text-[13px] text-gray-400">
                <span className="font-medium text-white">{store.nombre}</span> fue creada. Conectá TiendaNube para empezar a ver datos.
              </p>

              {/* TiendaNube — manual token */}
              <div className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-white">TiendaNube</p>
                    <p className="text-[11px] text-gray-500">Pegá el Access Token y Store ID de tu tienda</p>
                  </div>
                </div>

                {tnConnected ? (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-[12px] text-emerald-400 font-medium">{tnMessage}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="kpi-label mb-1 block">Access Token</label>
                      <input
                        type="text"
                        value={tnToken}
                        onChange={(e) => setTnToken(e.target.value)}
                        placeholder="ej: 1a2b3c4d5e6f7g8h..."
                        className="input-dark w-full font-mono"
                      />
                    </div>
                    <div>
                      <label className="kpi-label mb-1 block">Store ID (user_id)</label>
                      <input
                        type="text"
                        value={tnStoreId}
                        onChange={(e) => setTnStoreId(e.target.value)}
                        placeholder="ej: 1234567"
                        className="input-dark w-full font-mono"
                      />
                    </div>
                    <button
                      onClick={handleConnectTNManual}
                      disabled={connectingTN || !tnToken.trim() || !tnStoreId.trim()}
                      className="btn-primary w-full disabled:opacity-50"
                    >
                      {connectingTN ? 'Conectando...' : 'Conectar y sincronizar'}
                    </button>
                    <p className="text-[11px] text-gray-600">
                      Los datos los encontrás en las variables de entorno de tu app en Railway o en TiendaNube Partners.
                    </p>
                  </div>
                )}
              </div>

              {/* Meta Ads */}
              <div className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-white">Meta Ads</p>
                      <p className="text-[11px] text-gray-500">Importá datos via CSV desde la pestaña Meta Ads</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex justify-end gap-3">
          {step === 'name' && (
            <>
              <button onClick={onClose} className="btn-ghost">
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!nombre.trim() || saving}
                className="btn-primary disabled:opacity-50"
              >
                {saving ? 'Creando...' : 'Crear tienda'}
              </button>
            </>
          )}
          {step === 'integrations' && (
            <>
              <button onClick={handleSkipToStore} className="btn-ghost">
                Configurar después
              </button>
              <button
                onClick={handleGoToStore}
                className="btn-primary"
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