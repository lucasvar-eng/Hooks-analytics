import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import AIAnalysisPanel from '../components/common/AIAnalysisPanel';
import ClaudeActionBar from '../components/common/ClaudeActionBar';

const TIPO_TABS = [
  { value: '', label: 'Todas' },
  { value: 'frase', label: 'Frases' },
  { value: 'objecion', label: 'Objeciones' },
  { value: 'vocabulario', label: 'Vocabulario' },
  { value: 'hook', label: 'Hooks' },
];

const TIPO_BADGE = {
  frase: 'badge-blue',
  objecion: 'badge-red',
  vocabulario: 'bg-purple-500/15 text-purple-400 badge',
  hook: 'badge-green',
};

const SENTIMENT_BADGE = {
  positivo: 'badge-green',
  neutro: 'badge-gray',
  negativo: 'badge-red',
};

const TIPO_LABELS = { frase: 'Frase', objecion: 'Objeción', vocabulario: 'Vocabulario', hook: 'Hook' };
const SENTIMENT_LABELS = { positivo: 'Positivo', neutro: 'Neutro', negativo: 'Negativo' };

const AWARENESS_LABELS = {
  unaware: 'No consciente',
  'problem-aware': 'Problema',
  'solution-aware': 'Solución',
  'product-aware': 'Producto',
  'most-aware': 'Muy consciente',
  unknown: 'Sin definir',
};

const EMPTY_FORM = {
  tipo: 'frase',
  texto: '',
  response: '',
  tags: '',
  sentiment: 'neutro',
  avatar: '',
  awarenessLevel: 'unknown',
  angle: '',
  territory: '',
  objectionStage: '',
};

export default function LanguageBank() {
  const { storeId } = useParams();
  const [entries, setEntries] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeTab ? `?tipo=${activeTab}` : '';
      const [entriesRes, overviewRes] = await Promise.all([
        api.get(`/api/stores/${storeId}/language-bank${params}`),
        api.get(`/api/stores/${storeId}/language-bank/overview`),
      ]);
      setEntries(entriesRes.data);
      setOverview(overviewRes.data);
    } catch {}
    setLoading(false);
  }, [storeId, activeTab]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean) };
    try {
      if (editId) {
        await api.put(`/api/stores/${storeId}/language-bank/${editId}`, payload);
      } else {
        await api.post(`/api/stores/${storeId}/language-bank`, payload);
      }
      setForm(EMPTY_FORM);
      setEditId(null);
      setShowForm(false);
      fetchEntries();
    } catch {}
  };

  const handleEdit = (entry) => {
    setForm({
      tipo: entry.tipo,
      texto: entry.texto,
      response: entry.response || '',
      tags: (entry.tags || []).join(', '),
      sentiment: entry.sentiment || 'neutro',
      avatar: entry.avatar || '',
      awarenessLevel: entry.awarenessLevel || 'unknown',
      angle: entry.angle || '',
      territory: entry.territory || '',
      objectionStage: entry.objectionStage || '',
    });
    setEditId(entry._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    await api.delete(`/api/stores/${storeId}/language-bank/${id}`);
    fetchEntries();
  };

  const handleToggleForm = () => {
    setShowForm(!showForm);
    setEditId(null);
    setForm(EMPTY_FORM);
  };

  const summary = overview?.summary || {};
  const gaps = overview?.gaps || {};

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Banco de Lenguaje</h1>
          <p className="page-subtitle">Frases, objeciones, vocabulario y hooks del brand.</p>
        </div>
        <button onClick={handleToggleForm} className="btn-primary">
          {showForm ? 'Cancelar' : '+ Agregar entrada'}
        </button>
      </div>

      <ClaudeActionBar
        mode="language-bank"
        storeId={storeId}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Entradas', summary.total || 0],
          ['Hooks', summary.hooks || 0],
          ['Objeciones', summary.objections || 0],
          ['Sin respuesta', summary.unresolvedObjections || 0],
          ['Sin avatar', summary.missingAvatar || 0],
          ['Sin ángulo', summary.missingAngle || 0],
          ['Sin territorio', summary.missingTerritory || 0],
          ['Tab activa', activeTab || 'todas'],
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-app-muted text-[10px] uppercase tracking-[0.18em]">{label}</p>
            <p className="text-white text-2xl font-semibold mt-2">{String(value)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
        <div className="card p-4">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">Huecos de lenguaje</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[10px] text-app-muted uppercase tracking-[0.16em] mb-2">Objeciones sin respuesta</p>
              <div className="space-y-1 text-[12px] text-app-secondary">
                {(gaps.unresolvedObjections || []).length ? gaps.unresolvedObjections.map((item) => <p key={item}>{item}</p>) : <p>Sin huecos.</p>}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[10px] text-app-muted uppercase tracking-[0.16em] mb-2">Sin avatar</p>
              <div className="space-y-1 text-[12px] text-app-secondary">
                {(gaps.missingAvatar || []).length ? gaps.missingAvatar.map((item) => <p key={item}>{item}</p>) : <p>Sin huecos.</p>}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[10px] text-app-muted uppercase tracking-[0.16em] mb-2">Sin ángulo</p>
              <div className="space-y-1 text-[12px] text-app-secondary">
                {(gaps.missingAngle || []).length ? gaps.missingAngle.map((item) => <p key={item}>{item}</p>) : <p>Sin huecos.</p>}
              </div>
            </div>
          </div>
        </div>
        <AIAnalysisPanel storeId={storeId} section="language-bank" />
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="kpi-label mb-1 block">Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="input-dark w-full">
                <option value="frase">Frase</option>
                <option value="objecion">Objeción</option>
                <option value="vocabulario">Vocabulario</option>
                <option value="hook">Hook</option>
              </select>
            </div>
            <div>
              <label className="kpi-label mb-1 block">Sentiment</label>
              <select value={form.sentiment} onChange={(e) => setForm({ ...form, sentiment: e.target.value })} className="input-dark w-full">
                <option value="positivo">Positivo</option>
                <option value="neutro">Neutro</option>
                <option value="negativo">Negativo</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="kpi-label mb-1 block">Avatar</label>
              <input value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value })} className="input-dark w-full" />
            </div>
            <div>
              <label className="kpi-label mb-1 block">Nivel de consciencia</label>
              <select value={form.awarenessLevel} onChange={(e) => setForm({ ...form, awarenessLevel: e.target.value })} className="input-dark w-full">
                <option value="unknown">Sin definir</option>
                <option value="unaware">No consciente</option>
                <option value="problem-aware">Problema</option>
                <option value="solution-aware">Solución</option>
                <option value="product-aware">Producto</option>
                <option value="most-aware">Muy consciente</option>
              </select>
            </div>
            <div>
              <label className="kpi-label mb-1 block">Ángulo</label>
              <input value={form.angle} onChange={(e) => setForm({ ...form, angle: e.target.value })} className="input-dark w-full" />
            </div>
            <div>
              <label className="kpi-label mb-1 block">Territorio</label>
              <input value={form.territory} onChange={(e) => setForm({ ...form, territory: e.target.value })} className="input-dark w-full" />
            </div>
          </div>
          <div>
            <label className="kpi-label mb-1 block">Texto</label>
            <textarea value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} required rows={3} className="input-dark w-full" />
          </div>
          {form.tipo === 'objecion' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="kpi-label mb-1 block">Respuesta sugerida</label>
                <textarea value={form.response} onChange={(e) => setForm({ ...form, response: e.target.value })} rows={3} className="input-dark w-full" />
              </div>
              <div>
                <label className="kpi-label mb-1 block">Etapa de objeción</label>
                <input value={form.objectionStage} onChange={(e) => setForm({ ...form, objectionStage: e.target.value })} rows={3} className="input-dark w-full" />
              </div>
            </div>
          )}
          <div>
            <label className="kpi-label mb-1 block">Tags (separados por coma)</label>
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="ej: urgencia, descuento, confianza" className="input-dark w-full" />
          </div>
          <button type="submit" className="btn-primary">{editId ? 'Actualizar' : 'Agregar'}</button>
        </form>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-white/[0.06] pb-0">
        {TIPO_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition ${
              activeTab === tab.value
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-[13px] text-gray-600">Cargando banco de lenguaje...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-[13px] text-gray-600">
          No hay entradas aún. Hacé click en "+ Agregar entrada" para empezar.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full table-dark">
            <thead>
              <tr>
                <th className="text-left w-1/2">Texto</th>
                <th className="text-left">Tipo</th>
                <th className="text-left">Sentiment</th>
                <th className="text-left">Framework</th>
                <th className="text-left">Tags</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry._id}>
                  <td className="text-gray-300">
                    <p>{entry.texto}</p>
                    {entry.tipo === 'objecion' && entry.response && (
                      <p className="mt-1 ml-3 pl-2.5 border-l-2 border-white/[0.08] text-[10px] text-gray-600 italic">
                        {entry.response}
                      </p>
                    )}
                  </td>
                  <td>
                    <span className={TIPO_BADGE[entry.tipo] || 'badge-gray'}>
                      {TIPO_LABELS[entry.tipo] || entry.tipo}
                    </span>
                  </td>
                  <td>
                    <span className={SENTIMENT_BADGE[entry.sentiment] || SENTIMENT_BADGE.neutro}>
                      {SENTIMENT_LABELS[entry.sentiment] || entry.sentiment}
                    </span>
                  </td>
                  <td className="text-app-secondary text-[11px]">
                    <p>{entry.avatar || 'Sin avatar'}</p>
                    <p>{AWARENESS_LABELS[entry.awarenessLevel] || 'Sin definir'}</p>
                    {entry.angle && <p>{entry.angle}</p>}
                    {entry.territory && <p>{entry.territory}</p>}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {(entry.tags || []).map((tag) => (
                        <span key={tag} className="chip text-[10px] py-0">{tag}</span>
                      ))}
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => handleEdit(entry)} className="text-[11px] text-gray-500 hover:text-gray-300 transition">Editar</button>
                      <button onClick={() => handleDelete(entry._id)} className="text-[11px] text-gray-500 hover:text-red-400 transition">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
