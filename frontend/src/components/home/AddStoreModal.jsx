import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const CRO_CENTRAL_TN_STORES = {
  '6444342': 'MANGUZ',
  '2638533': 'Limite Deportes',
};

const PLATFORM_OPTIONS = [
  {
    key: 'tiendanube',
    title: 'Tienda Nube',
    description: 'Conectá con access token + store ID y traé el nombre real de la tienda.',
  },
  {
    key: 'shopify',
    title: 'Shopify',
    description: 'Conectá con dominio + Admin API access token.',
  },
  {
    key: 'manual',
    title: 'Manual',
    description: 'Creá una tienda vacía y configurala después.',
  },
];

function PlatformCard({ option, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.key)}
      className={`w-full p-4 rounded-xl border text-left transition ${
        selected
          ? 'border-blue-500/40 bg-blue-500/[0.05]'
          : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14]'
      }`}
    >
      <p className="text-[13px] font-semibold text-white">{option.title}</p>
      <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{option.description}</p>
    </button>
  );
}

export default function AddStoreModal({ onClose, onCreated }) {
  const navigate = useNavigate();
  const [step, setStep] = useState('platform');
  const [platform, setPlatform] = useState('tiendanube');
  const [aliasNombre, setAliasNombre] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [store, setStore] = useState(null);
  const [connectionInfo, setConnectionInfo] = useState(null);

  const [tnToken, setTnToken] = useState('');
  const [tnStoreId, setTnStoreId] = useState('');
  const [shopifyToken, setShopifyToken] = useState('');
  const [shopifyDomain, setShopifyDomain] = useState('');
  const usesCentralTnToken = Boolean(CRO_CENTRAL_TN_STORES[tnStoreId.trim()]);

  const title = useMemo(() => {
    if (step === 'platform') return 'Nueva tienda';
    if (step === 'credentials') return 'Vincular tienda';
    return 'Tienda creada';
  }, [step]);

  const canContinue = platform === 'manual' || platform === 'tiendanube' || platform === 'shopify';

  const handleContinue = () => {
    setError(null);
    if (!canContinue) return;
    setStep('credentials');
  };

  const handleCreate = async () => {
    setSaving(true);
    setError(null);

    try {
      const payload = { platform, aliasNombre: aliasNombre.trim() || undefined };

      if (platform === 'manual') {
        if (!aliasNombre.trim()) {
          setError('Para crear una tienda manual necesitás definir un nombre.');
          setSaving(false);
          return;
        }
      }

      if (platform === 'tiendanube') {
        Object.assign(payload, {
          tnStoreId: tnStoreId.trim(),
        });
        if (tnToken.trim()) {
          Object.assign(payload, { tnAccessToken: tnToken.trim() });
        }
      }

      if (platform === 'shopify') {
        Object.assign(payload, {
          shopifyAccessToken: shopifyToken.trim(),
          shopifyShopDomain: shopifyDomain.trim(),
        });
      }

      const { data } = await api.post('/api/stores/create-connected', payload);
      setStore(data.store);
      setConnectionInfo(data.connection || null);
      setStep('created');
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear y vincular la tienda');
    }

    setSaving(false);
  };

  const goToStore = (path = 'dashboard') => {
    if (!store?._id) return;
    navigate(`/store/${store._id}/${path}`);
  };

  const renderCredentials = () => {
    if (platform === 'manual') {
      return (
        <div className="space-y-4">
          <div>
            <label className="kpi-label mb-1.5 block">Nombre de la tienda</label>
            <input
              type="text"
              value={aliasNombre}
              onChange={(event) => setAliasNombre(event.target.value)}
              placeholder="Ej: Mi Tienda Online"
              className="input-dark w-full"
              autoFocus
            />
          </div>
        </div>
      );
    }

    if (platform === 'tiendanube') {
      return (
        <div className="space-y-4">
          <div>
            <label className="kpi-label mb-1.5 block">Nombre interno opcional</label>
            <input
              type="text"
              value={aliasNombre}
              onChange={(event) => setAliasNombre(event.target.value)}
              placeholder="Si lo dejás vacío, usamos el nombre real de Tienda Nube"
              className="input-dark w-full"
            />
          </div>
          <div>
            <label className="kpi-label mb-1 block">Access Token</label>
            <input
              type="text"
              value={tnToken}
              onChange={(event) => setTnToken(event.target.value)}
              placeholder={usesCentralTnToken ? 'Opcional para esta tienda' : 'ej: 1a2b3c4d5e6f...'}
              className="input-dark w-full font-mono"
              autoFocus={!usesCentralTnToken}
            />
          </div>
          <div>
            <label className="kpi-label mb-1 block">Store ID</label>
            <input
              type="text"
              value={tnStoreId}
              onChange={(event) => setTnStoreId(event.target.value)}
              placeholder="ej: 1234567"
              className="input-dark w-full font-mono"
              autoFocus={usesCentralTnToken}
            />
          </div>
          <p className="text-[11px] text-gray-600 leading-relaxed">
            {usesCentralTnToken
              ? `Esta tienda usa token centralizado desde CRO (${CRO_CENTRAL_TN_STORES[tnStoreId.trim()]}). Con el Store ID alcanza.`
              : 'Necesitás el token vinculado a esa tienda. El sistema valida productos y órdenes, y toma el nombre real automáticamente.'}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div>
          <label className="kpi-label mb-1.5 block">Nombre interno opcional</label>
          <input
            type="text"
            value={aliasNombre}
            onChange={(event) => setAliasNombre(event.target.value)}
            placeholder="Si lo dejás vacío, usamos el nombre real de Shopify"
            className="input-dark w-full"
          />
        </div>
        <div>
          <label className="kpi-label mb-1 block">Dominio de la tienda</label>
          <input
            type="text"
            value={shopifyDomain}
            onChange={(event) => setShopifyDomain(event.target.value)}
            placeholder="ej: marca.myshopify.com"
            className="input-dark w-full font-mono"
            autoFocus
          />
        </div>
        <div>
          <label className="kpi-label mb-1 block">Admin API Access Token</label>
          <input
            type="text"
            value={shopifyToken}
            onChange={(event) => setShopifyToken(event.target.value)}
            placeholder="shpat_..."
            className="input-dark w-full font-mono"
          />
        </div>
        <p className="text-[11px] text-gray-600 leading-relaxed">
          Para Shopify usamos el dominio de la tienda y un Admin API access token. La vinculación valida la tienda y dispara la sincronización de pedidos y productos.
        </p>
      </div>
    );
  };

  const canCreate =
    platform === 'manual'
      ? Boolean(aliasNombre.trim())
      : platform === 'tiendanube'
        ? Boolean(tnStoreId.trim() && (tnToken.trim() || usesCentralTnToken))
        : Boolean(shopifyToken.trim() && shopifyDomain.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#161616] border border-white/[0.08] rounded-xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-[15px] font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">
              {error}
            </div>
          )}

          {step === 'platform' && (
            <div className="space-y-3">
              <p className="text-[12px] text-gray-500">Elegí cómo querés vincular la tienda. Si conectás una plataforma, el sistema intenta tomar el nombre real automáticamente.</p>
              {PLATFORM_OPTIONS.map((option) => (
                <PlatformCard key={option.key} option={option} selected={platform === option.key} onSelect={setPlatform} />
              ))}
            </div>
          )}

          {step === 'credentials' && renderCredentials()}

          {step === 'created' && store && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="text-[13px] font-semibold text-emerald-300">La tienda quedó creada.</p>
                <p className="text-[12px] text-emerald-200/90 mt-1">
                  {store.nombre}
                </p>
                {connectionInfo?.message ? (
                  <p className="text-[11px] text-emerald-200/80 mt-2">{connectionInfo.message}</p>
                ) : null}
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-gray-500">Plataforma</span>
                  <span className="text-white capitalize">{store.plataforma || platform}</span>
                </div>
                {store.storeUrl ? (
                  <div className="flex items-center justify-between text-[12px] gap-3">
                    <span className="text-gray-500">Dominio</span>
                    <span className="text-white truncate">{store.storeUrl}</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/[0.06] flex justify-end gap-3">
          {step === 'platform' && (
            <>
              <button onClick={onClose} className="btn-ghost">Cancelar</button>
              <button onClick={handleContinue} className="btn-primary">Continuar</button>
            </>
          )}

          {step === 'credentials' && (
            <>
              <button onClick={() => setStep('platform')} className="btn-ghost">Volver</button>
              <button onClick={handleCreate} disabled={!canCreate || saving} className="btn-primary disabled:opacity-50">
                {saving ? 'Conectando...' : platform === 'manual' ? 'Crear tienda' : 'Vincular y crear'}
              </button>
            </>
          )}

          {step === 'created' && (
            <>
              <button onClick={() => goToStore('settings')} className="btn-ghost">Ir a configuración</button>
              <button onClick={() => goToStore('dashboard')} className="btn-primary">Ir al dashboard</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
