import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

export default function Competencia() {
  const { storeId } = useParams();
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    url: '',
    positioning: '',
    avatar: '',
    awarenessLevel: 'unknown',
    mainOffer: '',
    angles: '',
    territories: '',
    objectionsDetected: '',
    notas: '',
  });
  const [editId, setEditId] = useState(null);
  const [analyzing, setAnalyzing] = useState(null);
  const [opportunityState, setOpportunityState] = useState({ id: null, data: null, loading: false });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/stores/${storeId}/competitors`);
      setCompetitors(data);
    } catch {}
    setLoading(false);
  }, [storeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEdit = (c) => {
    setForm({
      nombre: c.nombre,
      url: c.url || '',
      positioning: c.positioning || '',
      avatar: c.avatar || '',
      awarenessLevel: c.awarenessLevel || 'unknown',
      mainOffer: c.mainOffer || '',
      angles: (c.angles || []).join(', '),
      territories: (c.territories || []).join(', '),
      objectionsDetected: (c.objectionsDetected || []).join(', '),
      notas: c.notas || '',
    });
    setEditId(c._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    await api.delete(`/api/stores/${storeId}/competitors/${id}`);
    fetchData();
  };

  const handleAnalyze = async (id) => {
    setAnalyzing(id);
    try {
      await api.post(`/api/stores/${storeId}/competitors/${id}/analyze`);
      fetchData();
    } catch {}
    setAnalyzing(null);
  };

  const handleOpportunities = async (competitor) => {
    setOpportunityState({ id: competitor._id, data: null, loading: true });
    try {
      const { data } = await api.post(`/api/stores/${storeId}/competitors/${competitor._id}/opportunities`);
      setOpportunityState({ id: competitor._id, data, loading: false });
    } catch {
      setOpportunityState({ id: competitor._id, data: null, loading: false });
    }
  };

  if (loading) return <div className="text-center py-12 text-[13px] text-gray-600">Cargando competencia...</div>;

  const submitPayload = {
    ...form,
    angles: form.angles.split(',').map((item) => item.trim()).filter(Boolean),
    territories: form.territories.split(',').map((item) => item.trim()).filter(Boolean),
    objectionsDetected: form.objectionsDetected.split(',').map((item) => item.trim()).filter(Boolean),
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Competencia</h1>
          <p className="page-subtitle">Seguimiento y análisis AI de competidores.</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ nombre: '', url: '', positioning: '', avatar: '', awarenessLevel: 'unknown', mainOffer: '', angles: '', territories: '', objectionsDetected: '', notas: '' }); }}
          className="btn-primary"
        >
          {showForm ? 'Cancelar' : '+ Agregar competidor'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => {
          e.preventDefault();
          (async () => {
            try {
              if (editId) {
                await api.put(`/api/stores/${storeId}/competitors/${editId}`, submitPayload);
              } else {
                await api.post(`/api/stores/${storeId}/competitors`, submitPayload);
              }
              setForm({ nombre: '', url: '', positioning: '', avatar: '', awarenessLevel: 'unknown', mainOffer: '', angles: '', territories: '', objectionsDetected: '', notas: '' });
              setEditId(null);
              setShowForm(false);
              fetchData();
            } catch {}
          })();
        }} className="card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="kpi-label mb-1 block">Nombre</label>
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                className="input-dark w-full"
              />
            </div>
            <div>
              <label className="kpi-label mb-1 block">URL</label>
              <input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="input-dark w-full"
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="kpi-label mb-1 block">Posicionamiento</label>
              <input value={form.positioning} onChange={(e) => setForm({ ...form, positioning: e.target.value })} className="input-dark w-full" />
            </div>
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
              <label className="kpi-label mb-1 block">Oferta principal</label>
              <input value={form.mainOffer} onChange={(e) => setForm({ ...form, mainOffer: e.target.value })} className="input-dark w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="kpi-label mb-1 block">Ángulos</label>
              <input value={form.angles} onChange={(e) => setForm({ ...form, angles: e.target.value })} className="input-dark w-full" placeholder="precio, autoridad, transformación" />
            </div>
            <div>
              <label className="kpi-label mb-1 block">Territorios</label>
              <input value={form.territories} onChange={(e) => setForm({ ...form, territories: e.target.value })} className="input-dark w-full" placeholder="confianza, urgencia, estilo" />
            </div>
            <div>
              <label className="kpi-label mb-1 block">Objeciones detectadas</label>
              <input value={form.objectionsDetected} onChange={(e) => setForm({ ...form, objectionsDetected: e.target.value })} className="input-dark w-full" placeholder="precio, calidad, entrega" />
            </div>
          </div>
          <div>
            <label className="kpi-label mb-1 block">Notas</label>
            <textarea
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              rows={2}
              className="input-dark w-full"
            />
          </div>
          <button type="submit" className="btn-primary">
            {editId ? 'Actualizar' : 'Agregar'}
          </button>
        </form>
      )}

      {competitors.length === 0 ? (
        <div className="text-center py-12 text-[13px] text-gray-600">
          No hay competidores agregados aún. Hacé click en "+ Agregar competidor" para empezar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {competitors.map((c) => (
            <div key={c._id} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-bold text-white">{c.nombre}</h3>
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400 hover:text-blue-300 transition">{c.url}</a>
                  )}
                  <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-app-secondary">
                    {c.positioning && <p><strong className="text-app-primary">Posicionamiento:</strong> {c.positioning}</p>}
                    {c.mainOffer && <p><strong className="text-app-primary">Oferta:</strong> {c.mainOffer}</p>}
                    {c.avatar && <p><strong className="text-app-primary">Avatar:</strong> {c.avatar}</p>}
                    {c.awarenessLevel && <p><strong className="text-app-primary">Consciencia:</strong> {c.awarenessLevel}</p>}
                  </div>
                  {(c.angles?.length || c.territories?.length || c.objectionsDetected?.length) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(c.angles || []).map((item) => <span key={`a-${item}`} className="chip text-[10px] py-0">{item}</span>)}
                      {(c.territories || []).map((item) => <span key={`t-${item}`} className="chip text-[10px] py-0">{item}</span>)}
                      {(c.objectionsDetected || []).map((item) => <span key={`o-${item}`} className="chip text-[10px] py-0">{item}</span>)}
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleOpportunities(c)}
                    disabled={opportunityState.loading && opportunityState.id === c._id}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition"
                  >
                    {opportunityState.loading && opportunityState.id === c._id ? 'Pensando...' : 'Oportunidades'}
                  </button>
                  <button
                    onClick={() => handleAnalyze(c._id)}
                    disabled={analyzing === c._id}
                    className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-50 transition"
                  >
                    {analyzing === c._id ? 'Analizando...' : 'Analizar AI'}
                  </button>
                  <button onClick={() => handleEdit(c)} className="text-[11px] text-gray-500 hover:text-gray-300 transition">Editar</button>
                  <button onClick={() => handleDelete(c._id)} className="text-[11px] text-gray-500 hover:text-red-400 transition">Eliminar</button>
                </div>
              </div>
              {c.notas && <p className="mt-2 text-[12px] text-gray-500 leading-relaxed">{c.notas}</p>}
              {c.analysisResult && (
                <div className="mt-3 p-3 bg-blue-500/[0.07] border border-blue-500/20 rounded-lg text-[12px] text-gray-400 leading-relaxed">
                  <p className="text-[10px] font-bold text-blue-400 mb-1.5 uppercase tracking-wider">
                    Análisis AI {c.lastAnalysis && `— ${new Date(c.lastAnalysis).toLocaleDateString('es-AR')}`}
                  </p>
                  <div
                    dangerouslySetInnerHTML={{
                      __html: c.analysisResult
                        .replace(/\n/g, '<br>')
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/^### (.*)/gm, '<h4 class="font-semibold mt-2">$1</h4>')
                        .replace(/^## (.*)/gm, '<h3 class="font-bold mt-2">$1</h3>')
                        .replace(/^- (.*)/gm, '<li>$1</li>'),
                    }}
                  />
                </div>
              )}
              {opportunityState.id === c._id && opportunityState.data?.opportunities?.length > 0 && (
                <div className="mt-3 p-3 bg-emerald-500/[0.07] border border-emerald-500/20 rounded-lg">
                  <p className="text-[10px] font-bold text-emerald-400 mb-2 uppercase tracking-wider">
                    Oportunidades AI {opportunityState.data.confidence != null && `— ${(opportunityState.data.confidence * 100).toFixed(0)}%`}
                  </p>
                  <div className="space-y-2">
                    {opportunityState.data.opportunities.map((item, index) => (
                      <div key={`${item.title}-${index}`} className="text-[12px]">
                        <p className="text-white font-medium">{item.title}</p>
                        <p className="text-app-secondary mt-0.5">{item.gap}</p>
                        <p className="text-app-primary mt-1">{item.action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
