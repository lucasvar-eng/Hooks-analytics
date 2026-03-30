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

  const [provider, setProvider] = useState('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [modelAnalysis, setModelAnalysis] = useState('');
  const [modelChat, setModelChat] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [instructions, setInstructions] = useState('');
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [instrMsg, setInstrMsg] = useState(null);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      const { data } = await api.get('/api/user/ai-config');
      setProvider(data.provider || 'anthropic');
      setHasApiKey(data.hasApiKey || false);
      setModelAnalysis(data.modelAnalysis || '');
      setModelChat(data.modelChat || '');
      setInstructions(data.globalInstructions || '');
      setFiles(data.globalFiles || []);
    } catch {}
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
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-[#0f0f0f] border-b border-white/[0.06] px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/')} className="text-[13px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition">
            ← Volver
          </button>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Mi perfil</p>
          <div className="w-16" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-5">
        {/* User info */}
        <div className="card p-5">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-4">Cuenta</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Nombre', value: user?.nombre },
              { label: 'Email', value: user?.email },
              { label: 'Rol', value: user?.role },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="kpi-label">{label}</p>
                <p className="text-[13px] text-white font-medium mt-0.5 capitalize">{value || '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Configuration */}
        <div className="card p-5">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-4">Configuración AI</p>
          <div className="space-y-4">
            <div>
              <label className="kpi-label mb-1 block">Proveedor</label>
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className="input-dark w-full">
                {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="kpi-label mb-1 block">API Key</label>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={hasApiKey ? '••••••••  (ya configurada)' : 'sk-...'}
                  className="input-dark flex-1 font-mono"
                />
                {hasApiKey && <span className="text-[12px] text-emerald-400 font-medium whitespace-nowrap">Configurada</span>}
              </div>
              <p className="text-[11px] text-gray-600 mt-1">
                {provider === 'anthropic' ? 'Conseguila en console.anthropic.com' : 'Conseguila en platform.openai.com'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="kpi-label mb-1 block">Modelo análisis</label>
                <input type="text" value={modelAnalysis} onChange={(e) => setModelAnalysis(e.target.value)} placeholder={defaultModels.analysis} className="input-dark w-full font-mono" />
              </div>
              <div>
                <label className="kpi-label mb-1 block">Modelo chat</label>
                <input type="text" value={modelChat} onChange={(e) => setModelChat(e.target.value)} placeholder={defaultModels.chat} className="input-dark w-full font-mono" />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button onClick={saveConfig} disabled={savingConfig} className="btn-primary disabled:opacity-50">
                {savingConfig ? 'Guardando...' : 'Guardar configuración'}
              </button>
              <button onClick={testConnection} disabled={testing} className="btn-secondary disabled:opacity-50">
                {testing ? 'Probando...' : 'Probar conexión'}
              </button>
            </div>
            {configMsg && <p className={`text-[12px] font-medium ${configMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{configMsg.text}</p>}
            {testResult && <p className={`text-[12px] font-medium ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>{testResult.text}</p>}
          </div>
        </div>

        {/* Global Instructions */}
        <div className="card p-5">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Instrucciones globales AI</p>
          <p className="text-[12px] text-gray-600 mb-3">
            Se aplican a todas las tiendas. Definí el tono, formato, enfoque o contexto que la AI debe tener en cuenta.
          </p>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={6}
            maxLength={10000}
            placeholder="Ej: Siempre incluí recomendaciones en pesos argentinos. Nuestro margen objetivo es 25%..."
            className="input-dark w-full resize-y"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-gray-600">{instructions.length}/10,000</span>
            <div className="flex items-center gap-3">
              {instrMsg && <span className={`text-[12px] font-medium ${instrMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{instrMsg.text}</span>}
              <button onClick={saveInstructions} disabled={savingInstructions} className="btn-primary disabled:opacity-50">
                {savingInstructions ? 'Guardando...' : 'Guardar instrucciones'}
              </button>
            </div>
          </div>
        </div>

        {/* Global Files */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Archivos de contexto global</p>
              <p className="text-[12px] text-gray-600 mt-0.5">Se inyectan como contexto en todas las consultas AI (max 5).</p>
            </div>
            <button onClick={uploadFile} disabled={uploading || files.length >= 5} className="btn-secondary text-[12px] disabled:opacity-50">
              {uploading ? 'Subiendo...' : '+ Subir archivo'}
            </button>
          </div>

          {files.length === 0 ? (
            <p className="text-[13px] text-gray-600">Sin archivos de contexto.</p>
          ) : (
            <div className="space-y-2">
              {files.map((f) => (
                <div key={f.filename} className="flex items-center justify-between py-2.5 px-3 bg-white/[0.03] rounded-lg border border-white/[0.05]">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-[13px] text-gray-300">{f.filename}</span>
                    <span className="text-[11px] text-gray-600">{f.uploadedAt && new Date(f.uploadedAt).toLocaleDateString('es-AR')}</span>
                  </div>
                  <button onClick={() => deleteFile(f.filename)} className="text-[11px] text-red-500 hover:text-red-400 transition">
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