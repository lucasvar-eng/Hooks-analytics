import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI (GPT)' },
];

export default function UserProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // AI Config
  const [provider, setProvider] = useState('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [modelAnalysis, setModelAnalysis] = useState('');
  const [modelChat, setModelChat] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Global instructions
  const [instructions, setInstructions] = useState('');
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [instrMsg, setInstrMsg] = useState(null);

  // Files
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data } = await api.get('/api/user/ai-config');
      setProvider(data.provider || 'anthropic');
      setHasApiKey(data.hasApiKey || false);
      setModelAnalysis(data.modelAnalysis || '');
      setModelChat(data.modelChat || '');
      setInstructions(data.globalInstructions || '');
      setFiles(data.globalFiles || []);
    } catch {
      // ignore — new user
    }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    setConfigMsg(null);
    try {
      const payload = { provider, modelAnalysis, modelChat };
      if (apiKey.trim()) payload.apiKey = apiKey.trim();
      await api.put('/api/user/ai-config', payload);
      setConfigMsg({ ok: true, text: 'Configuración guardada' });
      setHasApiKey(true);
      setApiKey('');
    } catch (err) {
      setConfigMsg({ ok: false, text: err.response?.data?.error || 'Error al guardar' });
    }
    setSavingConfig(false);
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/api/user/ai-test');
      setTestResult({ ok: true, text: `Conexión exitosa (${data.provider})` });
    } catch (err) {
      setTestResult({ ok: false, text: err.response?.data?.error || 'Error de conexión' });
    }
    setTesting(false);
  };

  const saveInstructions = async () => {
    setSavingInstructions(true);
    setInstrMsg(null);
    try {
      await api.put('/api/user/ai-instructions', { instructions });
      setInstrMsg({ ok: true, text: 'Instrucciones guardadas' });
    } catch (err) {
      setInstrMsg({ ok: false, text: err.response?.data?.error || 'Error al guardar' });
    }
    setSavingInstructions(false);
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
        await api.post('/api/user/ai-files', { filename: file.name, content });
        await loadConfig();
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
      await api.delete(`/api/user/ai-files/${encodeURIComponent(filename)}`);
      setFiles(files.filter((f) => f.filename !== filename));
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar');
    }
  };

  const defaultModels = provider === 'anthropic'
    ? { analysis: 'claude-sonnet-4-6', chat: 'claude-haiku-4-5-20251001' }
    : { analysis: 'gpt-4o', chat: 'gpt-4o-mini' };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
            &larr; Volver
          </button>
          <p className="section-label">Mi perfil</p>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-5">
        {/* User info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase mb-3">Cuenta</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Nombre:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100 font-medium">{user?.nombre}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Email:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100 font-medium">{user?.email}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Rol:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100 font-medium capitalize">{user?.role}</span>
            </div>
          </div>
        </div>

        {/* AI Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase mb-4">Configuración AI</h2>

          <div className="space-y-4">
            {/* Provider */}
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Proveedor</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* API Key */}
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">API Key</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={hasApiKey ? '••••••••  (ya configurada, dejar vacío para mantener)' : 'sk-...'}
                  className="flex-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 font-mono"
                />
                {hasApiKey && (
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium whitespace-nowrap">Configurada</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {provider === 'anthropic'
                  ? 'Conseguila en console.anthropic.com'
                  : 'Conseguila en platform.openai.com'}
              </p>
            </div>

            {/* Models */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Modelo análisis</label>
                <input
                  type="text"
                  value={modelAnalysis}
                  onChange={(e) => setModelAnalysis(e.target.value)}
                  placeholder={defaultModels.analysis}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Modelo chat</label>
                <input
                  type="text"
                  value={modelChat}
                  onChange={(e) => setModelChat(e.target.value)}
                  placeholder={defaultModels.chat}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 font-mono"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={saveConfig}
                disabled={savingConfig}
                className="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50 transition font-medium"
              >
                {savingConfig ? 'Guardando...' : 'Guardar configuración'}
              </button>
              <button
                onClick={testConnection}
                disabled={testing}
                className="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50 transition font-medium"
              >
                {testing ? 'Probando...' : 'Probar conexión'}
              </button>
            </div>

            {configMsg && (
              <p className={`text-xs font-medium ${configMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {configMsg.text}
              </p>
            )}
            {testResult && (
              <p className={`text-xs font-medium ${testResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {testResult.text}
              </p>
            )}
          </div>
        </div>

        {/* Global Instructions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase mb-2">Instrucciones globales AI</h2>
          <p className="text-xs text-gray-400 mb-3">
            Estas instrucciones se aplican a todas las tiendas. Definí el tono, formato, enfoque o cualquier contexto que la AI deba tener en cuenta.
          </p>

          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={6}
            maxLength={10000}
            placeholder="Ej: Siempre incluí recomendaciones de presupuesto en pesos argentinos. Nuestro margen objetivo es 25%. Priorizá el ROAS sobre el CPA..."
            className="w-full px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 resize-y"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">{instructions.length}/10,000</span>
            <div className="flex items-center gap-3">
              {instrMsg && (
                <span className={`text-xs font-medium ${instrMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {instrMsg.text}
                </span>
              )}
              <button
                onClick={saveInstructions}
                disabled={savingInstructions}
                className="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50 transition font-medium"
              >
                {savingInstructions ? 'Guardando...' : 'Guardar instrucciones'}
              </button>
            </div>
          </div>
        </div>

        {/* Global Files */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase">Archivos de contexto global</h2>
              <p className="text-xs text-gray-400 mt-1">Archivos .txt o .md que se inyectan como contexto en todas las consultas AI (max 5).</p>
            </div>
            <button
              onClick={uploadFile}
              disabled={uploading || files.length >= 5}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 disabled:opacity-50 transition"
            >
              {uploading ? 'Subiendo...' : '+ Subir archivo'}
            </button>
          </div>

          {files.length === 0 ? (
            <p className="text-sm text-gray-400">Sin archivos de contexto.</p>
          ) : (
            <div className="space-y-2">
              {files.map((f) => (
                <div key={f.filename} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-750 rounded border border-gray-100 dark:border-gray-700/60">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{f.filename}</span>
                    <span className="text-xs text-gray-400">
                      {f.uploadedAt && new Date(f.uploadedAt).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteFile(f.filename)}
                    className="text-xs text-red-500 hover:text-red-700 hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
