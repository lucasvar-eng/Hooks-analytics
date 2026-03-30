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
  frase: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  objecion: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  vocabulario: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  hook: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
};

const SENTIMENT_BADGE = {
  positivo: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  neutro: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  negativo: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
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
    const payload = {
      ...form,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    };
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="section-label">Banco de Lenguaje</p>
        <button
          onClick={handleToggleForm}
          className="px-3 py-1.5 bg-primary-600 text-white text-[11px] font-semibold rounded hover:bg-primary-700 transition"
        >
          {showForm ? 'Cancelar' : '+ Agregar entrada'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                className="w-full mt-1 px-2.5 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700/60 rounded bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="frase">Frase</option>
                <option value="objecion">Objeción</option>
                <option value="vocabulario">Vocabulario</option>
                <option value="hook">Hook</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Sentiment</label>
              <select
                value={form.sentiment}
                onChange={(e) => setForm({ ...form, sentiment: e.target.value })}
                className="w-full mt-1 px-2.5 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700/60 rounded bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="positivo">Positivo</option>
                <option value="neutro">Neutro</option>
                <option value="negativo">Negativo</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Texto</label>
            <textarea
              value={form.texto}
              onChange={(e) => setForm({ ...form, texto: e.target.value })}
              required
              rows={3}
              className="w-full mt-1 px-2.5 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700/60 rounded bg-white dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          {form.tipo === 'objecion' && (
            <div>
              <label className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Respuesta sugerida</label>
              <textarea
                value={form.response}
                onChange={(e) => setForm({ ...form, response: e.target.value })}
                rows={3}
                className="w-full mt-1 px-2.5 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700/60 rounded bg-white dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          )}
          <div>
            <label className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Tags (separados por coma)</label>
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="ej: urgencia, descuento, confianza"
              className="w-full mt-1 px-2.5 py-1.5 text-[12px] border border-gray-200 dark:border-gray-700/60 rounded bg-white dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-primary-600 text-white text-[11px] font-semibold rounded hover:bg-primary-700 transition">
            {editId ? 'Actualizar' : 'Agregar'}
          </button>
        </form>
      )}

      {/* Filter tabs */}
      <div className="flex gap-[2px] bg-gray-100 dark:bg-gray-800 rounded p-0.5 w-fit">
        {TIPO_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-3 py-1.5 text-[11px] font-semibold rounded transition ${
              activeTab === tab.value
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs text-gray-500 dark:text-gray-500">Cargando banco de lenguaje...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-[11px] text-gray-400 dark:text-gray-500">
          No hay entradas aún. Hacé click en "+ Agregar entrada" para empezar.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-white/[0.02]">
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60 w-1/2">Texto</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">Tipo</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">Sentiment</th>
                <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">Tags</th>
                <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/60">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry._id} className="border-b border-gray-100 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition">
                  <td className="px-3 py-2.5 text-gray-900 dark:text-gray-100">
                    <p>{entry.texto}</p>
                    {entry.tipo === 'objecion' && entry.response && (
                      <p className="mt-1 ml-3 pl-2.5 border-l-2 border-gray-200 dark:border-gray-700/60 text-[10px] text-gray-400 dark:text-gray-500 italic">
                        {entry.response}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${TIPO_BADGE[entry.tipo] || ''}`}>
                      {TIPO_LABELS[entry.tipo] || entry.tipo}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${SENTIMENT_BADGE[entry.sentiment] || SENTIMENT_BADGE.neutro}`}>
                      {SENTIMENT_LABELS[entry.sentiment] || entry.sentiment}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {(entry.tags || []).map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 text-[9px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => handleEdit(entry)} className="text-[10px] text-gray-400 hover:text-primary-500 transition">Editar</button>
                      <button onClick={() => handleDelete(entry._id)} className="text-[10px] text-gray-400 hover:text-red-500 transition">Eliminar</button>
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
