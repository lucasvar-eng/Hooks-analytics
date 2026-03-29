import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

function AIConfigSection() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase">AI</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        La configuración de proveedor AI, API key y modelos se gestiona desde tu perfil de usuario.
      </p>
      <Link
        to="/profile"
        className="inline-block px-3 py-1.5 bg-violet-600 text-white text-xs rounded hover:bg-violet-700 transition font-medium"
      >
        Ir a mi perfil
      </Link>
    </div>
  );
}

function StoreAIContextSection({ storeId }) {
  const [instructions, setInstructions] = useState('');
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    loadContext();
  }, [storeId]);

  const loadContext = async () => {
    try {
      const { data } = await api.get(`/api/stores/${storeId}/ai-context`);
      setInstructions(data.instructions || '');
      setFiles(data.files || []);
    } catch {
      // ignore
    }
  };

  const saveInstructions = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.put(`/api/stores/${storeId}/ai-context`, { instructions });
      setMsg({ ok: true, text: 'Instrucciones guardadas' });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.error || 'Error al guardar' });
    }
    setSaving(false);
  };

  const uploadFile = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.csv';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploading(true);
      try {
        const content = await file.text();
        await api.post(`/api/stores/${storeId}/ai-context/files`, { filename: file.name, content });
        await loadContext();
      } catch (err) {
        alert(err.response?.data?.error || 'Error al subir archivo');
      }
      setUploading(false);
    };
    input.click();
  };

  const deleteFile = async (filename) => {
    if (!confirm(`Eliminar "${filename}"?`)) return;
    try {
      await api.delete(`/api/stores/${storeId}/ai-context/files/${encodeURIComponent(filename)}`);
      setFiles(files.filter((f) => f.filename !== filename));
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">Contexto AI de la tienda</h3>
      <p className="text-xs text-gray-400 mb-3">
        Instrucciones específicas para esta tienda. Se suman a tus instrucciones globales de perfil.
      </p>

      <textarea
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        rows={4}
        maxLength={10000}
        placeholder="Ej: Esta tienda vende ropa deportiva. El ticket promedio objetivo es $45.000. Priorizá recomendaciones de cross-sell..."
        className="w-full px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 resize-y mb-2"
      />
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-400">{instructions.length}/10,000</span>
        <div className="flex items-center gap-3">
          {msg && (
            <span className={`text-xs font-medium ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {msg.text}
            </span>
          )}
          <button
            onClick={saveInstructions}
            disabled={saving}
            className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50 transition font-medium"
          >
            {saving ? 'Guardando...' : 'Guardar instrucciones'}
          </button>
        </div>
      </div>

      {/* Files */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Archivos de contexto (max 5)</span>
        <button
          onClick={uploadFile}
          disabled={uploading || files.length >= 5}
          className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 disabled:opacity-50"
        >
          {uploading ? 'Subiendo...' : '+ Subir'}
        </button>
      </div>
      {files.length === 0 ? (
        <p className="text-xs text-gray-400">Sin archivos.</p>
      ) : (
        <div className="space-y-1">
          {files.map((f) => (
            <div key={f.filename} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 dark:bg-gray-750 rounded text-sm">
              <span className="text-gray-700 dark:text-gray-300">{f.filename}</span>
              <button onClick={() => deleteFile(f.filename)} className="text-xs text-red-500 hover:underline">Eliminar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { storeId } = useParams();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // TN manual connection
  const [tnToken, setTnToken] = useState('');
  const [tnStoreIdInput, setTnStoreIdInput] = useState('');
  const [connectingTN, setConnectingTN] = useState(false);

  // Editable fields
  const [tasaIBB, setTasaIBB] = useState(0);
  const [feePlataformaPct, setFeePlataformaPct] = useState(0);
  const [comisiones, setComisiones] = useState([]);

  useEffect(() => {
    api.get(`/api/stores/${storeId}`).then(({ data }) => {
      setStore(data);
      setTasaIBB(data.tasaIBB || 0);
      setFeePlataformaPct(data.feePlataformaPct || 0);
      setComisiones(data.comisionPagoConfig || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [storeId]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.put(`/api/stores/${storeId}/settings/costos`, {
        tasaIBB,
        feePlataformaPct,
        comisionPagoConfig: comisiones,
      });
      setMessage('Guardado. Recalculando órdenes en background...');
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
    setSaving(false);
  };

  const addComision = () => {
    setComisiones([...comisiones, { medioPago: '', cuotas: 1, comisionBase: 0, comisionCuotas: 0 }]);
  };

  const updateComision = (idx, field, value) => {
    const updated = [...comisiones];
    updated[idx] = { ...updated[idx], [field]: field === 'medioPago' ? value : Number(value) };
    setComisiones(updated);
  };

  const removeComision = (idx) => {
    setComisiones(comisiones.filter((_, i) => i !== idx));
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando settings...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings — {store?.nombre}</h2>

      {/* Integrations status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase">Integraciones</h3>
        <div className="space-y-4">
          {/* TiendaNube */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${store?.integrationStatus?.tiendanube?.connected ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">TiendaNube</span>
                {store?.integrationStatus?.tiendanube?.connected && (
                  <span className="text-xs text-gray-400 ml-1">
                    (Store ID: {store?.tnStoreId})
                    {store?.integrationStatus?.tiendanube?.lastSync && (
                      <> — Sync: {new Date(store.integrationStatus.tiendanube.lastSync).toLocaleString('es-AR')}</>
                    )}
                  </span>
                )}
              </div>
              {store?.integrationStatus?.tiendanube?.connected ? (
                <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">Conectada</span>
              ) : (
                <span className="text-xs text-gray-400">No conectada</span>
              )}
            </div>

            {/* Manual TN connection form — always shown when not connected */}
            {!store?.integrationStatus?.tiendanube?.connected && (
              <div className="mt-3 p-4 rounded-lg bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Pegá el Access Token y Store ID de TiendaNube. Los podés encontrar en las variables de entorno de tu app (ej: Railway) o en el panel de TiendaNube Partners.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Access Token</label>
                    <input
                      type="text"
                      value={tnToken}
                      onChange={(e) => setTnToken(e.target.value)}
                      placeholder="ej: 1a2b3c4d5e6f7g8h..."
                      className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Store ID (user_id)</label>
                    <input
                      type="text"
                      value={tnStoreIdInput}
                      onChange={(e) => setTnStoreIdInput(e.target.value)}
                      placeholder="ej: 1234567"
                      className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (!tnToken.trim() || !tnStoreIdInput.trim()) return;
                        setConnectingTN(true);
                        setMessage(null);
                        try {
                          const { data } = await api.post(`/api/stores/${storeId}/connect-tn-manual`, {
                            tnAccessToken: tnToken.trim(),
                            tnStoreId: tnStoreIdInput.trim(),
                          });
                          setMessage(data.message);
                          // Refresh store data
                          const { data: updated } = await api.get(`/api/stores/${storeId}`);
                          setStore(updated);
                        } catch (err) {
                          setMessage(`Error: ${err.response?.data?.error || err.message}`);
                        }
                        setConnectingTN(false);
                      }}
                      disabled={connectingTN || !tnToken.trim() || !tnStoreIdInput.trim()}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition font-medium"
                    >
                      {connectingTN ? 'Conectando...' : 'Conectar y sincronizar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Meta Ads */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${store?.integrationStatus?.metaAds?.connected ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Meta Ads</span>
            </div>
            {store?.integrationStatus?.metaAds?.connected ? (
              <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">Conectada</span>
            ) : (
              <span className="text-xs text-gray-400">Usá la importación CSV desde la pestaña Meta Ads</span>
            )}
          </div>
        </div>
      </div>

      {/* AI Configuration */}
      <AIConfigSection />

      {/* Store AI Context */}
      <StoreAIContextSection storeId={storeId} />

      {/* Financial config */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase">Configuración financiera</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-gray-500">Tasa IBB (%)</label>
            <input type="number" step="0.1" value={tasaIBB} onChange={(e) => setTasaIBB(+e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Fee Plataforma (%)</label>
            <input type="number" step="0.1" value={feePlataformaPct} onChange={(e) => setFeePlataformaPct(+e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          </div>
        </div>
      </div>

      {/* Comisiones de pago */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase">Comisiones de pago</h3>
          <button onClick={addComision} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400">
            + Agregar
          </button>
        </div>

        {comisiones.length === 0 ? (
          <p className="text-sm text-gray-400">Sin comisiones configuradas.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500">
                <th className="text-left py-1">Medio de pago</th>
                <th className="text-left py-1">Cuotas</th>
                <th className="text-left py-1">Comisión base %</th>
                <th className="text-left py-1">Comisión cuotas %</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {comisiones.map((c, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="py-1">
                    <select value={c.medioPago} onChange={(e) => updateComision(i, 'medioPago', e.target.value)} className="px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
                      <option value="">Seleccionar</option>
                      {['mercadopago', 'visa', 'mastercard', 'amex', 'debito', 'transferencia', 'efectivo', 'otro'].map((mp) => (
                        <option key={mp} value={mp}>{mp}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1"><input type="number" value={c.cuotas} onChange={(e) => updateComision(i, 'cuotas', e.target.value)} className="w-16 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" /></td>
                  <td className="py-1"><input type="number" step="0.1" value={c.comisionBase} onChange={(e) => updateComision(i, 'comisionBase', e.target.value)} className="w-20 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" /></td>
                  <td className="py-1"><input type="number" step="0.1" value={c.comisionCuotas} onChange={(e) => updateComision(i, 'comisionCuotas', e.target.value)} className="w-20 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" /></td>
                  <td className="py-1"><button onClick={() => removeComision(i)} className="text-red-500 text-xs hover:underline">X</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar y recalcular'}
        </button>
        {message && <span className="text-sm text-gray-600 dark:text-gray-400">{message}</span>}
      </div>
    </div>
  );
}
