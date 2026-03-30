import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

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

const EMPTY_FORM = { tipo: 'frase', texto: '', response: '', tags: '', sentiment: 'neutro' };

export default function LanguageBank() {
  const { storeId } = useParams();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeTab ? `?tipo=${activeTab}` : '';
      const { data } = await api.get(`/api/stores/${storeId}/language-bank${params}`);
      setEntries(data);
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
    setForm({ tipo: entry.tipo, texto: entry.texto, response: entry.response || '', tags: (entry.tags || []).join(', '), sentiment: entry.sentiment || 'neutro' });
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

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
          <div>
            <label className="kpi-label mb-1 block">Texto</label>
            <textarea value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} required rows={3} className="input-dark w-full" />
          </div>
          {form.tipo === 'objecion' && (
            <div>
              <label className="kpi-label mb-1 block">Respuesta sugerida</label>
              <textarea value={form.response} onChange={(e) => setForm({ ...form, response: e.target.value })} rows={3} className="input-dark w-full" />
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