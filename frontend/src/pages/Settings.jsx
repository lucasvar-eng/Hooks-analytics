import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

function AIConfigSection() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase">AI</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        La configuración de proveedor AI, API key y modelos se gestiona desde tu perfil de usuario.
      </p>
      <Link
        to="/profile"
        className="inline-block px-3 py-1.5 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 transition font-medium"
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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
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
            className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 disabled:opacity-50 transition font-medium"
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
      if (data.objetivos) setObj({ ...obj, ...data.objetivos });
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
    { key: 'conversionRateTarget', label: 'Tasa Conversión Target', suffix: '%', step: 0.1 },
    { key: 'tasaDevolucionMax', label: 'Tasa Devolución Máx.', suffix: '%', step: 1 },
  ];

  const beFields = [
    { key: 'roasBreakeven', label: 'ROAS Breakeven', suffix: 'x', step: 0.1 },
    { key: 'cpaBreakeven', label: 'CPA Breakeven', prefix: '$', step: 100 },
    { key: 'aovMinimo', label: 'AOV Mínimo', prefix: '$', step: 100 },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase">Objetivos y KPIs</h3>

      <div className="mb-4">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">Fase de la tienda</label>
        <select value={obj.fase} onChange={(e) => setObj({ ...obj, fase: e.target.value })} className="w-full px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
          {FASES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>

      <p className="text-xs text-gray-400 mb-2">KPIs Target</p>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {kpiFields.map((f) => (
          <div key={f.key}>
            <label className="text-xs text-gray-500 dark:text-gray-400">{f.label}</label>
            <div className="flex items-center gap-1 mt-1">
              {f.prefix && <span className="text-xs text-gray-400">{f.prefix}</span>}
              <input type="number" step={f.step} value={obj.kpis[f.key] ?? ''} onChange={(e) => updateKpi(f.key, e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" placeholder="—" />
              {f.suffix && <span className="text-xs text-gray-400">{f.suffix}</span>}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mb-2">Breakeven</p>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {beFields.map((f) => (
          <div key={f.key}>
            <label className="text-xs text-gray-500 dark:text-gray-400">{f.label}</label>
            <div className="flex items-center gap-1 mt-1">
              {f.prefix && <span className="text-xs text-gray-400">{f.prefix}</span>}
              <input type="number" step={f.step} value={obj.breakeven[f.key] ?? ''} onChange={(e) => updateBe(f.key, e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" placeholder="—" />
              {f.suffix && <span className="text-xs text-gray-400">{f.suffix}</span>}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mb-2">Umbrales de alerta (% desviación del target)</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-gray-500">Warning (%)</label>
          <input type="number" step="1" value={obj.alertThresholds?.warningPct ?? 10} onChange={(e) => updateAt('warningPct', e.target.value)} className="w-full mt-1 px-2 py-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
        </div>
        <div>
          <label className="text-xs text-gray-500">Critical (%)</label>
          <input type="number" step="1" value={obj.alertThresholds?.criticalPct ?? 25} onChange={(e) => updateAt('criticalPct', e.target.value)} className="w-full mt-1 px-2 py-1.5 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 disabled:opacity-50 transition font-medium">
          {saving ? 'Guardando...' : 'Guardar objetivos'}
        </button>
        {msg && <span className={`text-xs font-medium ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

function CotizacionDolarPanel({ storeId }) {
  const [cotizacion, setCotizacion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.get(`/api/stores/${storeId}`).then(({ data }) => {
      setCotizacion(data.cotizacionDolar || 0);
    }).catch(() => {});
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
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase">Cotización USD</h3>
      <p className="text-xs text-gray-400 mb-3">Tipo de cambio para convertir Ad Spend (USD) a ARS. Se usa en cálculos de ROAS real, CPA y márgenes.</p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-500">1 USD =</span>
          <input type="number" step="1" value={cotizacion} onChange={(e) => setCotizacion(+e.target.value)} className="w-28 px-3 py-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
          <span className="text-sm text-gray-500">ARS</span>
        </div>
        <button onClick={save} disabled={saving} className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 disabled:opacity-50 transition font-medium">
          {saving ? '...' : 'Guardar'}
        </button>
        {msg && <span className={`text-xs font-medium ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{msg.text}</span>}
      </div>
    </div>
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

  const update = (cat, key, val) => {
    setThresholds((prev) => ({
      ...prev,
      [cat]: { ...prev[cat], [key]: val === '' ? '' : Number(val) },
    }));
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      // Clean empty strings to undefined
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
    { cat: 'escalar', label: 'ESCALAR', color: 'text-green-600 dark:text-green-400', fields: [
      { key: 'roasMin', label: 'ROAS mín.', suffix: 'x', step: 0.1 },
      { key: 'minSpend', label: 'Gasto mín.', prefix: '$', step: 1000 },
      { key: 'minPurchases', label: 'Compras mín.', step: 1 },
    ]},
    { cat: 'mantener', label: 'MANTENER', color: 'text-gray-600 dark:text-gray-400', fields: [
      { key: 'roasMin', label: 'ROAS mín.', suffix: 'x', step: 0.1 },
      { key: 'minSpend', label: 'Gasto mín.', prefix: '$', step: 1000 },
    ]},
    { cat: 'revisar', label: 'REVISAR', color: 'text-orange-600 dark:text-orange-400', fields: [
      { key: 'roasMin', label: 'ROAS mín.', suffix: 'x', step: 0.1 },
      { key: 'cpaMaxPct', label: 'CPA máx. vs target', suffix: '%', step: 10 },
    ]},
    { cat: 'pausar', label: 'PAUSAR', color: 'text-red-600 dark:text-red-400', fields: [
      { key: 'roasMax', label: 'ROAS máx.', suffix: 'x', step: 0.1 },
      { key: 'minSpend', label: 'Gasto mín. para pausar', prefix: '$', step: 1000 },
      { key: 'minDays', label: 'Días mín. activo', step: 1 },
    ]},
    { cat: 'testear', label: 'TESTEAR', color: 'text-blue-600 dark:text-blue-400', fields: [
      { key: 'maxSpend', label: 'Gasto máx. (poco data)', prefix: '$', step: 1000 },
      { key: 'maxPurchases', label: 'Compras máx. (poco data)', step: 1 },
    ]},
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase">Umbrales de veredicto de Ads</h3>
        <button onClick={generateWithAI} disabled={generating} className="text-xs px-2 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded hover:bg-violet-200 dark:hover:bg-violet-800/40 disabled:opacity-50 font-medium">
          {generating ? 'Generando...' : 'Generar con AI'}
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-4">Definí cuándo un anuncio se clasifica como ESCALAR, PAUSAR, etc. Si dejás vacío se usan valores por defecto. Podés generar con AI basado en tu data histórica.</p>

      <div className="space-y-4">
        {categories.map((c) => (
          <div key={c.cat} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-750 border border-gray-100 dark:border-gray-700/60">
            <p className={`text-xs font-bold mb-2 ${c.color}`}>{c.label}</p>
            <div className="grid grid-cols-3 gap-2">
              {c.fields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-gray-500">{f.label}</label>
                  <div className="flex items-center gap-1 mt-0.5">
                    {f.prefix && <span className="text-xs text-gray-400">{f.prefix}</span>}
                    <input type="number" step={f.step} value={thresholds[c.cat][f.key]} onChange={(e) => update(c.cat, f.key, e.target.value)} className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" placeholder="auto" />
                    {f.suffix && <span className="text-xs text-gray-400">{f.suffix}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button onClick={save} disabled={saving} className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 disabled:opacity-50 transition font-medium">
          {saving ? 'Guardando...' : 'Guardar umbrales'}
        </button>
        {msg && <span className={`text-xs font-medium ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{msg.text}</span>}
      </div>
    </div>
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
      if (selected.length >= 5) {
        setLimitMsg(true);
        return;
      }
      setSelected([...selected, key]);
    }
    setMsg(null);
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api.put(`/api/stores/${storeId}`, { metricasHome: selected });
      setMsg({ ok: true, text: 'Métricas guardadas' });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.error || 'Error al guardar' });
    }
    setSaving(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase">Métricas de Home</h3>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        Elegí hasta 5 métricas para mostrar en la tarjeta de Home de esta tienda.
      </p>
      <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-3">
        {ALL_METRICS.map((m) => {
          const isChecked = selected.includes(m.key);
          return (
            <label key={m.key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(m.key)}
                className="accent-indigo-600 w-4 h-4 cursor-pointer"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{m.label}</span>
            </label>
          );
        })}
      </div>
      {limitMsg && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">Máximo 5 métricas</p>
      )}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || selected.length === 0}
          className="px-3 py-1.5 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 disabled:opacity-50 transition font-medium"
        >
          {saving ? 'Guardando...' : 'Guardar métricas'}
        </button>
        <span className="text-xs text-gray-400 dark:text-gray-500">{selected.length}/5 seleccionadas</span>
        {msg && (
          <span className={`text-xs font-medium ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {msg.text}
          </span>
        )}
      </div>
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
    <div className="space-y-5 max-w-3xl">
      <p className="section-label">Settings — {store?.nombre}</p>

      {/* Integrations status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
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

      {/* Objetivos y KPIs */}
      <ObjetivosPanel storeId={storeId} />

      {/* Cotización USD */}
      <CotizacionDolarPanel storeId={storeId} />

      {/* Ad Verdict Thresholds */}
      <AdVerdictThresholdsPanel storeId={storeId} />

      {/* Home metric selector */}
      <MetricSelectorSection storeId={storeId} />

      {/* Financial config */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
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
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700/60 p-4">
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
                <tr key={i} className="border-t border-gray-100 dark:border-gray-700/60">
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
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:opacity-50">
          {saving ? 'Guardando...' : 'Guardar y recalcular'}
        </button>
        {message && <span className="text-sm text-gray-600 dark:text-gray-400">{message}</span>}
      </div>
    </div>
  );
}
