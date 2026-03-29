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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Banco de Lenguaje</h2>
        <button
          onClick={handleToggleForm}
          className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
        >
          {showForm ? 'Cancelar' : '+ Agregar entrada'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              >
                <option value="frase">Frase</option>
                <option value="objecion">Objeción</option>
                <option value="vocabulario">Vocabulario</option>
                <option value="hook">Hook</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Sentiment</label>
              <select
                value={form.sentiment}
                onChange={(e) => setForm({ ...form, sentiment: e.target.value })}
                className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              >
                <option value="positivo">Positivo</option>
                <option value="neutro">Neutro</option>
                <option value="negativo">Negativo</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Texto</label>
            <textarea
              value={form.texto}
              onChange={(e) => setForm({ ...form, texto: e.target.value })}
              required
              rows={3}
              className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </div>
          {form.tipo === 'objecion' && (
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Respuesta sugerida</label>
              <textarea
                value={form.response}
                onChange={(e) => setForm({ ...form, response: e.target.value })}
                rows={3}
                className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Tags (separados por coma)</label>
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="ej: urgencia, descuento, confianza"
              className="w-full mt-1 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
            {editId ? 'Actualizar' : 'Agregar'}
          </button>
        </form>
      )}

      {/* Filter tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1 -mb-px">
          {TIPO_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.value
                  ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Cargando banco de lenguaje...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No hay entradas aún. Hacé click en "+ Agregar entrada" para empezar.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-750">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-600 dark:text-gray-400 w-1/2">Texto</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-600 dark:text-gray-400">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-600 dark:text-gray-400">Sentiment</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-600 dark:text-gray-400">Tags</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-600 dark:text-gray-400">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {entries.map((entry) => (
                <tr key={entry._id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition">
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                    <p>{entry.texto}</p>
                    {entry.tipo === 'objecion' && entry.response && (
                      <p className="mt-1 ml-3 pl-3 border-l-2 border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 italic">
                        {entry.response}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${TIPO_BADGE[entry.tipo] || ''}`}>
                      {TIPO_LABELS[entry.tipo] || entry.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${SENTIMENT_BADGE[entry.sentiment] || SENTIMENT_BADGE.neutro}`}>
                      {SENTIMENT_LABELS[entry.sentiment] || entry.sentiment}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(entry.tags || []).map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => handleEdit(entry)} className="text-xs text-gray-500 hover:text-indigo-500">Editar</button>
                      <button onClick={() => handleDelete(entry._id)} className="text-xs text-gray-500 hover:text-red-500">Eliminar</button>
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
