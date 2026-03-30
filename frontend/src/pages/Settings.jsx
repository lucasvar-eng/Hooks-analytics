import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

function SectionCard({ title, children }) {
  return (
    <div className="card p-5">
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-4">{title}</p>
      {children}
    </div>
  );
}

function AIConfigSection() {
  return (
    <SectionCard title="AI">
      <p className="text-[12px] text-gray-600 mb-3">
        La configuración de proveedor AI, API key y modelos se gestiona desde tu perfil de usuario.
      </p>
      <Link to="/profile" className="btn-primary inline-block text-[12px]">
        Ir a mi perfil
      </Link>
    </SectionCard>
  );
}

function StoreAIContextSection({ storeId }) {
  const [instructions, setInstructions] = useState('');
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { loadContext(); }, [storeId]);

  const loadContext = async () => {
    try {
      const { data } = await api.get(`/api/stores/${storeId}/ai-context`);
      setInstructions(data.instructions || '');
      setFiles(data.files || []);
    } catch {}
  };

  const saveInstructions = async () => {
    setSaving(true); setMsg(null);
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
    <SectionCard title="Contexto AI de la tienda">
      <p className="text-[12px] text-gray-600 mb-3">
        Instrucciones específicas para esta tienda. Se suman a tus instrucciones globales de perfil.
      </p>
      <textarea
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        rows={4}
        maxLength={10000}
        placeholder="Ej: Esta tienda vende ropa deportiva. El ticket promedio objetivo es $45.000..."
        className="input-dark w-full resize-y mb-2"
      />
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] text-gray-600">{instructions.length}/10,000</span>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-[12px] font-medium ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>}
          <button onClick={saveInstructions} disabled={saving} className="btn-primary text-[12px] disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar instrucciones'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] text-gray-500">Archivos de contexto (max 5)</span>
        <button onClick={uploadFile} disabled={uploading || files.length >= 5} className="btn-ghost text-[12px] disabled:opacity-50">
          {uploading ? 'Subiendo...' : '+ Subir'}
        </button>
      </div>
      {files.length === 0 ? (
        <p className="text-[12px] text-gray-600">Sin archivos.</p>
      ) : (
        <div className="space-y-1.5">
          {files.map((f) => (
            <div key={f.filename} className="flex items-center justify-between py-2 px-3 bg-white/[0.03] rounded-lg border border-white/[0.05]">
              <span className="text-[12px] text-gray-300">{f.filename}</span>
              <button onClick={() => deleteFile(f.filename)} className="text-[11px] text-red-500 hover:text-red-400 transition">Eliminar</button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

const FASES = [
  { value: 'lanzamiento', label: 'Lanzamiento' },
  { value: 'crecimiento', label: 'Crecimiento' },
  { value: 'escalamiento', label: 'Escalamiento' },
  { value: 'optimizacion', label: 'Optimización' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
];

function ObjetivosPanel({ storeId }) {
  const [obj, setObj] = useState({ fase: 'crecimiento', kpis: {}, breakeven: {}, alertThresholds: { warningPct: 10, criticalPct: 25 } });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.get(`/api/stores/${storeId}`).then(({ data }) => {
      if (data.objetivos) setObj((prev) => ({ ...prev, ...data.objetivos }));
    }).catch(() => {});
  }, [storeId]);

  const updateKpi = (key, val) => setObj({ ...obj, kpis: { ...obj.kpis, [key]: val === '' ? undefined : Number(val) } });
  const updateBe = (key, val) => setObj({ ...obj, breakeven: { ...obj.breakeven, [key]: val === '' ? undefined : Number(val) } });
  const updateAt = (key, val) => setObj({ ...obj, alertThresholds: { ...obj.alertThresholds, [key]: Number(val) } });

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      await api.put(`/api/stores/${storeId}`, { objetivos: obj });
      setMsg({ ok: true, text: 'Objetivos guardados' });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.error || 'Error' });
    }
    setSaving(false);
  };

  const kpiFields = [
    { key: 'roasTarget', label: 'ROAS Target', suffix: 'x', step: 0.1 },
    { key: 'trueRoasTarget', label: 'True ROAS Target', suffix: 'x', step: 0.1 },
    { key: 'cpaMaximo', label: 'CPA Máximo', prefix: '$', step: 100 },
    { key: 'trueCpaMaximo', label: 'True CPA Máximo', prefix: '$', step: 100 },
    { key: 'profitMarginMin', label: 'Margen Profit Mín.', suffix: '%', step: 1 },
    { key: 'aovTarget', label: 'AOV Target', prefix: '$', step: 100 },
    { key: 'ncPctTarget', label: 'NC % Target', suffix: '%', step: 1 },
    { key: 'conversionRateTarget', label: 'CVR Target', suffix: '%', step: 0.1 },
    { key: 'tasaDevolucionMax', label: 'Tasa Dev. Máx.', suffix: '%', step: 1 },
  ];

  const beFields = [
    { key: 'roasBreakeven', label: 'ROAS Breakeven', suffix: 'x', step: 0.1 },
    { key: 'cpaBreakeven', label: 'CPA Breakeven', prefix: '$', step: 100 },
    { key: 'aovMinimo', label: 'AOV Mínimo', prefix: '$', step: 100 },
  ];

  function NumInput({ value, onChange, step, prefix, suffix }) {
    return (
      <div className="flex items-center gap-1">
        {prefix && <span className="text-[11px] text-gray-600">{prefix}</span>}
        <input type="number" step={step} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="input-dark w-full" placeholder="—" />
        {suffix && <span className="text-[11px] text-gray-600">{suffix}</span>}
      </div>
    );
  }

  return (
    <SectionCard title="Objetivos y KPIs">
      <div className="mb-4">
        <label className="kpi-label mb-1 block">Fase de la tienda</label>
        <select value={obj.fase} onChange={(e) => setObj({ ...obj, fase: e.target.value })} className="input-dark w-full">
          {FASES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      <p className="text-[11px] text-gray-600 mb-2 uppercase tracking-wider">KPIs Target</p>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {kpiFields.map((f) => (
          <div key={f.key}>
            <label className="kpi-label mb-1 block">{f.label}</label>
            <NumInput value={obj.kpis[f.key]} onChange={(v) => updateKpi(f.key, v)} step={f.step} prefix={f.prefix} suffix={f.suffix} />
          </div>
        ))}
      </div>

      <p className="text-[11px] text-gray-600 mb-2 uppercase tracking-wider">Breakeven</p>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {beFields.map((f) => (
          <div key={f.key}>
            <label className="kpi-label mb-1 block">{f.label}</label>
            <NumInput value={obj.breakeven[f.key]} onChange={(v) => updateBe(f.key, v)} step={f.step} prefix={f.prefix} suffix={f.suffix} />
          </div>
        ))}
      </div>

      <p className="text-[11px] text-gray-600 mb-2 uppercase tracking-wider">Umbrales de alerta (% desviación del target)</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="kpi-label mb-1 block">Warning (%)</label>
          <input type="number" step="1" value={obj.alertThresholds?.warningPct ?? 10} onChange={(e) => updateAt('warningPct', e.target.value)} className="input-dark w-full" />
        </div>
        <div>
          <label className="kpi-label mb-1 block">Critical (%)</label>
          <input type="number" step="1" value={obj.alertThresholds?.criticalPct ?? 25} onChange={(e) => updateAt('criticalPct', e.target.value)} className="input-dark w-full" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar objetivos'}</button>
        {msg && <span className={`text-[12px] font-medium ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </SectionCard>
  );
}

function CotizacionDolarPanel({ storeId }) {
  const [cotizacion, setCotizacion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.get(`/api/stores/${storeId}`).then(({ data }) => setCotizacion(data.cotizacionDolar || 0)).catch(() => {});
  }, [storeId]);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      await api.put(`/api/stores/${storeId}`, { cotizacionDolar: cotizacion });
      setMsg({ ok: true, text: 'Cotización guardada' });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.error || 'Error' });
    }
    setSaving(false);
  };

  return (
    <SectionCard title="Cotización USD">
      <p className="text-[12px] text-gray-600 mb-3">Tipo de cambio para convertir Ad Spend (USD) a ARS.</p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-gray-500">1 USD =</span>
          <input type="number" step="1" value={cotizacion} onChange={(e) => setCotizacion(+e.target.value)} className="input-dark w-28" />
          <span className="text-[13px] text-gray-500">ARS</span>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? '...' : 'Guardar'}</button>
        {msg && <span className={`text-[12px] font-medium ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </SectionCard>
  );
}

function AdVerdictThresholdsPanel({ storeId }) {
  const [thresholds, setThresholds] = useState({
    escalar: { roasMin: '', minSpend: '', minPurchases: '' },
    mantener: { roasMin: '', minSpend: '' },
    revisar: { roasMin: '', cpaMaxPct: '' },
    pausar: { roasMax: '', minSpend: '', minDays: '' },
    testear: { maxSpend: '', maxPurchases: '' },
  });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.get(`/api/stores/${storeId}`).then(({ data }) => {
      if (data.adVerdictThresholds) {
        setThresholds((prev) => {
          const merged = { ...prev };
          for (const cat of Object.keys(prev)) {
            if (data.adVerdictThresholds[cat]) {
              merged[cat] = { ...prev[cat] };
              for (const key of Object.keys(prev[cat])) {
                merged[cat][key] = data.adVerdictThresholds[cat][key] ?? '';
              }
            }
          }
          return merged;
        });
      }
    }).catch(() => {});
  }, [storeId]);

  const update = (cat, key, val) => setThresholds((prev) => ({ ...prev, [cat]: { ...prev[cat], [key]: val === '' ? '' : Number(val) } }));

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const clean = {};
      for (const cat of Object.keys(thresholds)) {
        clean[cat] = {};
        for (const [k, v] of Object.entries(thresholds[cat])) {
          if (v !== '' && v != null) clean[cat][k] = Number(v);
        }
      }
      await api.put(`/api/stores/${storeId}`, { adVerdictThresholds: clean });
      setMsg({ ok: true, text: 'Umbrales guardados' });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.error || 'Error' });
    }
    setSaving(false);
  };

  const generateWithAI = async () => {
    setGenerating(true); setMsg(null);
    try {
      const { data } = await api.post(`/api/stores/${storeId}/generate-verdict-thresholds`);
      if (data.thresholds) {
        setThresholds((prev) => {
          const merged = { ...prev };
          for (const cat of Object.keys(prev)) {
            if (data.thresholds[cat]) {
              merged[cat] = { ...prev[cat] };
              for (const key of Object.keys(prev[cat])) {
                merged[cat][key] = data.thresholds[cat][key] ?? prev[cat][key];
              }
            }
          }
          return merged;
        });
      }
      setMsg({ ok: true, text: 'Umbrales generados por AI. Revisalos y guardá.' });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.error || 'Error al generar' });
    }
    setGenerating(false);
  };

  const categories = [
    { cat: 'escalar', label: 'ESCALAR', color: 'text-emerald-400', fields: [
      { key: 'roasMin', label: 'ROAS mín.', suffix: 'x', step: 0.1 },
      { key: 'minSpend', label: 'Gasto mín.', prefix: '$', step: 1000 },
      { key: 'minPurchases', label: 'Compras mín.', step: 1 },
    ]},
    { cat: 'mantener', label: 'MANTENER', color: 'text-gray-400', fields: [
      { key: 'roasMin', label: 'ROAS mín.', suffix: 'x', step: 0.1 },
      { key: 'minSpend', label: 'Gasto mín.', prefix: '$', step: 1000 },
    ]},
    { cat: 'revisar', label: 'REVISAR', color: 'text-amber-400', fields: [
      { key: 'roasMin', label: 'ROAS mín.', suffix: 'x', step: 0.1 },
      { key: 'cpaMaxPct', label: 'CPA máx. vs target', suffix: '%', step: 10 },
    ]},
    { cat: 'pausar', label: 'PAUSAR', color: 'text-red-400', fields: [
      { key: 'roasMax', label: 'ROAS máx.', suffix: 'x', step: 0.1 },
      { key: 'minSpend', label: 'Gasto mín. para pausar', prefix: '$', step: 1000 },
      { key: 'minDays', label: 'Días mín. activo', step: 1 },
    ]},
    { cat: 'testear', label: 'TESTEAR', color: 'text-blue-400', fields: [
      { key: 'maxSpend', label: 'Gasto máx. (poco data)', prefix: '$', step: 1000 },
      { key: 'maxPurchases', label: 'Compras máx. (poco data)', step: 1 },
    ]},
  ];

  return (
    <SectionCard title="Umbrales de veredicto de Ads">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] text-gray-600">Definí cuándo un anuncio se clasifica como ESCALAR, PAUSAR, etc. Podés generar con AI basado en tu data histórica.</p>
        <button onClick={generateWithAI} disabled={generating} className="btn-ghost text-[12px] disabled:opacity-50">
          {generating ? 'Generando...' : 'Generar con AI'}
        </button>
      </div>

      <div className="space-y-3">
        {categories.map((c) => (
          <div key={c.cat} className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
            <p className={`text-[11px] font-bold mb-2.5 ${c.color}`}>{c.label}</p>
            <div className="grid grid-cols-3 gap-2">
              {c.fields.map((f) => (
                <div key={f.key}>
                  <label className="kpi-label mb-1 block">{f.label}</label>
                  <div className="flex items-center gap-1">
                    {f.prefix && <span className="text-[11px] text-gray-600">{f.prefix}</span>}
                    <input type="number" step={f.step} value={thresholds[c.cat][f.key]} onChange={(e) => update(c.cat, f.key, e.target.value)} className="input-dark w-full" placeholder="auto" />
                    {f.suffix && <span className="text-[11px] text-gray-600">{f.suffix}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Guardando...' : 'Guardar umbrales'}</button>
        {msg && <span className={`text-[12px] font-medium ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </SectionCard>
  );
}

const ALL_METRICS = [
  { key: 'ordenesPositivas', label: 'Órdenes positivas' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'netRevenue', label: 'Net Revenue' },
  { key: 'profit', label: 'Profit' },
  { key: 'profitMargin', label: 'Margen de Profit (%)' },
  { key: 'adSpend', label: 'Ad Spend' },
  { key: 'roas', label: 'ROAS' },
  { key: 'trueRoas', label: 'True ROAS' },
  { key: 'cpa', label: 'CPA' },
  { key: 'trueCpa', label: 'True CPA' },
  { key: 'ncPct', label: 'NC %' },
  { key: 'aov', label: 'AOV' },
  { key: 'conversionRate', label: 'Tasa de conversión' },
  { key: 'ctr', label: 'CTR (%)' },
  { key: 'cpm', label: 'CPM' },
  { key: 'devoluciones', label: 'Devoluciones' },
];

function MetricSelectorSection({ storeId }) {
  const [selected, setSelected] = useState(['ordenesPositivas', 'revenue', 'trueRoas', 'profit', 'ncPct']);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [limitMsg, setLimitMsg] = useState(false);

  useEffect(() => {
    api.get(`/api/stores/${storeId}`).then(({ data }) => {
      if (data.metricasHome?.length) setSelected(data.metricasHome);
    }).catch(() => {});
  }, [storeId]);

  const toggle = (key) => {
    setLimitMsg(false);
    if (selected.includes(key)) {
      setSelected(selected.filter((k) => k !== key));
    } else {
      if (selected.length >= 5) { setLimitMsg(true); return; }
      setSelected([...selected, key]);
    }
    setMsg(null);
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      await api.put(`/api/stores/${storeId}`, { metricasHome: selected });
      setMsg({ ok: true, text: 'Métricas guardadas' });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.error || 'Error al guardar' });
    }
    setSaving(false);
  };

  return (
    <SectionCard title="Métricas de Home">
      <p className="text-[12px] text-gray-600 mb-3">Elegí hasta 5 métricas para mostrar en la tarjeta de Home de esta tienda.</p>
      <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-3">
        {ALL_METRICS.map((m) => (
          <label key={m.key} className="flex items-center gap-2.5 cursor-pointer group">
            <input type="checkbox" checked={selected.includes(m.key)} onChange={() => toggle(m.key)} className="w-4 h-4 accent-blue-500 rounded" />
            <span className="text-[13px] text-gray-400 group-hover:text-gray-200 transition">{m.label}</span>
          </label>
        ))}
      </div>
      {limitMsg && <p className="text-[12px] text-amber-400 mb-2">Máximo 5 métricas</p>}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving || selected.length === 0} className="btn-primary disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar métricas'}
        </button>
        <span className="text-[12px] text-gray-600">{selected.length}/5 seleccionadas</span>
        {msg && <span className={`text-[12px] font-medium ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</span>}
      </div>
    </SectionCard>
  );
}

export default function Settings() {
  const { storeId } = useParams();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [tnToken, setTnToken] = useState('');
  const [tnStoreIdInput, setTnStoreIdInput] = useState('');
  const [connectingTN, setConnectingTN] = useState(false);
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
    setSaving(true); setMessage(null);
    try {
      await api.put(`/api/stores/${storeId}/settings/costos`, { tasaIBB, feePlataformaPct, comisionPagoConfig: comisiones });
      setMessage('Guardado. Recalculando órdenes en background...');
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.error || err.message}`);
    }
    setSaving(false);
  };

  const addComision = () => setComisiones([...comisiones, { medioPago: '', cuotas: 1, comisionBase: 0, comisionCuotas: 0 }]);
  const updateComision = (idx, field, value) => {
    const updated = [...comisiones];
    updated[idx] = { ...updated[idx], [field]: field === 'medioPago' ? value : Number(value) };
    setComisiones(updated);
  };
  const removeComision = (idx) => setComisiones(comisiones.filter((_, i) => i !== idx));

  if (loading) return <div className="text-center py-12 text-[13px] text-gray-600">Cargando settings...</div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">{store?.nombre} — Configuración de integraciones, objetivos y costos.</p>
      </div>

      {/* Integrations */}
      <SectionCard title="Integraciones">
        <div className="space-y-4">
          {/* TiendaNube */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${store?.integrationStatus?.tiendanube?.connected ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                <span className="text-[13px] font-medium text-white">TiendaNube</span>
                {store?.integrationStatus?.tiendanube?.connected && (
                  <span className="text-[11px] text-gray-500">
                    (Store ID: {store?.tnStoreId})
                    {store?.integrationStatus?.tiendanube?.lastSync && (
                      <> — Sync: {new Date(store.integrationStatus.tiendanube.lastSync).toLocaleString('es-AR')}</>
                    )}
                  </span>
                )}
              </div>
              {store?.integrationStatus?.tiendanube?.connected ? (
                <span className="badge-green">Conectada</span>
              ) : (
                <span className="text-[11px] text-gray-600">No conectada</span>
              )}
            </div>

            {!store?.integrationStatus?.tiendanube?.connected && (
              <div className="mt-3 p-4 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-3">
                <p className="text-[12px] text-gray-500">
                  Pegá el Access Token y Store ID de TiendaNube.
                </p>
                <div>
                  <label className="kpi-label mb-1 block">Access Token</label>
                  <input type="text" value={tnToken} onChange={(e) => setTnToken(e.target.value)} placeholder="ej: 1a2b3c4d..." className="input-dark w-full font-mono" />
                </div>
                <div>
                  <label className="kpi-label mb-1 block">Store ID (user_id)</label>
                  <input type="text" value={tnStoreIdInput} onChange={(e) => setTnStoreIdInput(e.target.value)} placeholder="ej: 1234567" className="input-dark w-full font-mono" />
                </div>
                <button
                  onClick={async () => {
                    if (!tnToken.trim() || !tnStoreIdInput.trim()) return;
                    setConnectingTN(true); setMessage(null);
                    try {
                      const { data } = await api.post(`/api/stores/${storeId}/connect-tn-manual`, { tnAccessToken: tnToken.trim(), tnStoreId: tnStoreIdInput.trim() });
                      setMessage(data.message);
                      const { data: updated } = await api.get(`/api/stores/${storeId}`);
                      setStore(updated);
                    } catch (err) {
                      setMessage(`Error: ${err.response?.data?.error || err.message}`);
                    }
                    setConnectingTN(false);
                  }}
                  disabled={connectingTN || !tnToken.trim() || !tnStoreIdInput.trim()}
                  className="btn-primary disabled:opacity-50"
                >
                  {connectingTN ? 'Conectando...' : 'Conectar y sincronizar'}
                </button>
              </div>
            )}
          </div>

          {/* Meta Ads */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${store?.integrationStatus?.metaAds?.connected ? 'bg-emerald-500' : 'bg-gray-600'}`} />
              <span className="text-[13px] font-medium text-white">Meta Ads</span>
            </div>
            {store?.integrationStatus?.metaAds?.connected ? (
              <span className="badge-green">Conectada</span>
            ) : (
              <span className="text-[11px] text-gray-600">Usá la importación CSV desde la pestaña Meta Ads</span>
            )}
          </div>
        </div>
      </SectionCard>

      <AIConfigSection />
      <StoreAIContextSection storeId={storeId} />
      <ObjetivosPanel storeId={storeId} />
      <CotizacionDolarPanel storeId={storeId} />
      <AdVerdictThresholdsPanel storeId={storeId} />
      <MetricSelectorSection storeId={storeId} />

      {/* Financial config */}
      <SectionCard title="Configuración financiera">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="kpi-label mb-1 block">Tasa IBB (%)</label>
            <input type="number" step="0.1" value={tasaIBB} onChange={(e) => setTasaIBB(+e.target.value)} className="input-dark w-full" />
          </div>
          <div>
            <label className="kpi-label mb-1 block">Fee Plataforma (%)</label>
            <input type="number" step="0.1" value={feePlataformaPct} onChange={(e) => setFeePlataformaPct(+e.target.value)} className="input-dark w-full" />
          </div>
        </div>
      </SectionCard>

      {/* Comisiones */}
      <SectionCard title="Comisiones de pago">
        <div className="flex items-center justify-between mb-3">
          <span />
          <button onClick={addComision} className="btn-ghost text-[12px]">+ Agregar</button>
        </div>
        {comisiones.length === 0 ? (
          <p className="text-[13px] text-gray-600">Sin comisiones configuradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-dark">
              <thead>
                <tr>
                  <th className="text-left">Medio de pago</th>
                  <th className="text-left">Cuotas</th>
                  <th className="text-left">Com. base %</th>
                  <th className="text-left">Com. cuotas %</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {comisiones.map((c, i) => (
                  <tr key={i}>
                    <td>
                      <select value={c.medioPago} onChange={(e) => updateComision(i, 'medioPago', e.target.value)} className="input-dark">
                        <option value="">Seleccionar</option>
                        {['mercadopago', 'visa', 'mastercard', 'amex', 'debito', 'transferencia', 'efectivo', 'otro'].map((mp) => (
                          <option key={mp} value={mp}>{mp}</option>
                        ))}
                      </select>
                    </td>
                    <td><input type="number" value={c.cuotas} onChange={(e) => updateComision(i, 'cuotas', e.target.value)} className="input-dark w-16" /></td>
                    <td><input type="number" step="0.1" value={c.comisionBase} onChange={(e) => updateComision(i, 'comisionBase', e.target.value)} className="input-dark w-20" /></td>
                    <td><input type="number" step="0.1" value={c.comisionCuotas} onChange={(e) => updateComision(i, 'comisionCuotas', e.target.value)} className="input-dark w-20" /></td>
                    <td><button onClick={() => removeComision(i)} className="text-[11px] text-red-500 hover:text-red-400">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar y recalcular'}
        </button>
        {message && <span className="text-[13px] text-gray-400">{message}</span>}
      </div>
    </div>
  );
}