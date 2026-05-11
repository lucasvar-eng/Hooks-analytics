import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../services/api';
import AIAnalysisPanel from '../components/common/AIAnalysisPanel';
import MetricCompleteness from '../components/common/MetricCompleteness';
import CostsWizard from '../components/costs/CostsWizard';

function fmt(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

function pct(v) {
  if (v == null || isNaN(v)) return '—';
  return `${Number(v).toFixed(1)}%`;
}

function PnLSection({ pnl }) {
  if (!pnl) return null;

  return (
    <div className="card p-5">
      <p className="kpi-label mb-4">P&L del período</p>

      <div className="space-y-0.5">
        <div className="flex justify-between py-2.5 border-b border-white/[0.06]">
          <span className="text-[13px] font-semibold text-white">Revenue</span>
          <span className="text-[13px] font-bold text-white">{fmt(pnl.revenue)}</span>
        </div>

        {pnl.contributionProfit != null && (
          <div className="flex justify-between py-2 border-b border-white/[0.04]">
            <span className="text-[13px] text-app-secondary">Profit de contribución</span>
            <span className="text-[13px] text-emerald-400 font-semibold">{fmt(pnl.contributionProfit)}</span>
          </div>
        )}

        {pnl.lines?.map((line) => (
          <div key={line.label} className="flex justify-between py-2">
            <span className="text-[13px] text-app-secondary">– {line.label}</span>
            <span className="text-[13px] text-red-400">
              {fmt(line.value)} <span className="text-app-muted text-[11px]">({pct(line.pct)})</span>
            </span>
          </div>
        ))}

        <div className="flex justify-between py-2.5 border-t border-white/[0.06]">
          <span className="text-[13px] font-medium text-app-secondary">Total Costos</span>
          <span className="text-[13px] font-bold text-red-400">{fmt(pnl.totalCosts)}</span>
        </div>

        <div className="flex justify-between py-3 border-t border-white/[0.10]">
          <span className="text-[14px] font-bold text-white">Profit</span>
          <span className={`text-[14px] font-bold ${pnl.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(pnl.profit)} <span className="text-[12px]">({pct(pnl.profitMargin)})</span>
          </span>
        </div>

        {pnl.dataSource && (
          <p className="pt-2 text-[11px] text-app-muted">
            Fuente P&L: {pnl.dataSource === 'orders' ? 'órdenes crudas' : 'daily metrics heredadas'}
          </p>
        )}
      </div>
    </div>
  );
}

function BreakevenSection({ be }) {
  if (!be) return null;

  const cards = [
    { label: 'ROAS Breakeven', value: be.roasBreakeven?.toFixed(2) + 'x' },
    { label: 'CPA Breakeven', value: fmt(be.cpaBreakeven) },
    { label: 'AOV Mínimo', value: fmt(be.aovMinimo) },
    { label: 'AOV Actual', value: fmt(be.aov) },
  ];

  return (
    <div className="card p-5">
      <p className="kpi-label mb-4">Breakeven</p>
      <div className="grid grid-cols-2 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white/[0.03] rounded-lg p-3.5 border border-white/[0.05]">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">{c.label}</p>
            <p className="text-[20px] font-bold text-white">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinancialConsistencySection({ data, coverage, storeId }) {
  if (!data) return null;

  const statusTone =
    data.reconciliation?.status === 'aligned'
      ? 'badge-green'
      : 'badge-amber';

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="kpi-label">Verdad financiera</p>
          <p className="text-app-secondary text-[12px] mt-1">Definición oficial y calidad de respaldo del período.</p>
        </div>
        <span className={statusTone}>{data.reconciliation?.status === 'aligned' ? 'Alineado' : 'Revisar'}</span>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-app-muted text-[10px] uppercase tracking-wider">Profit oficial</p>
            {coverage?.isPreliminary && <MetricCompleteness coverage={coverage} storeId={storeId} size="sm" />}
          </div>
          <p className="text-white text-xl font-semibold mt-1">{fmt(data.officialMetric?.profit)}</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-app-muted text-[10px] uppercase tracking-wider">Margen oficial</p>
            {coverage?.isPreliminary && <MetricCompleteness coverage={coverage} storeId={storeId} size="sm" />}
          </div>
          <p className="text-white text-xl font-semibold mt-1">{pct(data.officialMetric?.profitMargin)}</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-app-muted text-[10px] uppercase tracking-wider">True ROAS oficial</p>
          <p className="text-white text-xl font-semibold mt-1">{Number(data.officialMetric?.trueRoas || 0).toFixed(2)}x</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-app-muted text-[10px] uppercase tracking-wider">Días con órdenes</p>
          <p className="text-white text-xl font-semibold mt-1">{Number(data.integrity?.ordersBackedPct || 0).toFixed(0)}%</p>
        </div>
      </div>

      <div className="space-y-1 text-[12px]">
        <p className="text-app-secondary">Fuente: <span className="text-app-primary">{data.officialMetric?.dataSource === 'orders' ? 'órdenes crudas' : 'daily metrics heredadas'}</span></p>
        <p className="text-app-secondary">Diferencia contribución vs aggregate: <span className="text-app-primary">{fmt(data.reconciliation?.contributionDiff)}</span></p>
        <p className="text-app-secondary">Diferencia profit oficial vs aggregate ajustado: <span className="text-app-primary">{fmt(data.reconciliation?.officialDiff)}</span></p>
        <p className="text-app-secondary">Calidad: <span className="text-app-primary">{data.quality?.note}</span></p>
      </div>
    </div>
  );
}

function CostCatalogSection({ overview, metrics }) {
  if (!overview?.summary) return null;

  const summary = overview.summary;
  const currentMetrics = metrics?.current || null;
  const storeRevenue = currentMetrics?.revenue || 0;
  const storeNetRevenue = currentMetrics?.netRevenue || 0;
  const productRevenue = summary.periodRevenue || 0;
  const grossGap = storeRevenue - productRevenue;
  const netGap = storeNetRevenue - productRevenue;
  const coveragePct = Number(summary.costCoveragePct || 0);

  let recommendation = 'La cobertura ya permite leer mejor el margen por SKU, aunque todavía conviene validar top sellers y categorías críticas.';
  if (coveragePct === 0) {
    recommendation = 'Todavía no hay costos de producto cargados. Empezá por los top sellers del período para desbloquear margen real y stock valorizado.';
  } else if (coveragePct < 40) {
    recommendation = 'La cobertura sigue baja. Priorizá los productos con más ingresos o unidades vendidas antes de expandir al catálogo completo.';
  } else if (coveragePct < 80) {
    recommendation = 'La base ya sirve para análisis parciales. Cerrá primero las categorías más vendidas para que el mix comercial quede confiable.';
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5">
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="kpi-label">Cobertura de costos del catálogo</p>
            <p className="text-app-secondary text-[12px] mt-1">Qué tan accionable es hoy la lectura de margen por producto.</p>
          </div>
          <span className={coveragePct >= 80 ? 'badge-green' : coveragePct >= 40 ? 'badge-amber' : 'badge-red'}>
            {coveragePct.toFixed(0)}% cubierto
          </span>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-app-muted text-[10px] uppercase tracking-wider">Productos</p>
            <p className="text-white text-xl font-semibold mt-1">{summary.totalProducts || 0}</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-app-muted text-[10px] uppercase tracking-wider">Con costo</p>
            <p className="text-white text-xl font-semibold mt-1">{summary.productsWithCosts || 0}</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-app-muted text-[10px] uppercase tracking-wider">Sin costo</p>
            <p className="text-white text-xl font-semibold mt-1">{summary.productsWithoutCosts || 0}</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-app-muted text-[10px] uppercase tracking-wider">Stock valorizado</p>
            <p className="text-white text-xl font-semibold mt-1">{fmt(summary.stockValue)}</p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-app-muted text-[10px] uppercase tracking-wider">Próximo paso recomendado</p>
          <p className="text-app-secondary text-[13px] mt-2">{recommendation}</p>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4">
          <p className="kpi-label">Cruce con ingresos</p>
          <p className="text-app-secondary text-[12px] mt-1">Para saber si el problema es costo faltante o una diferencia normal entre tienda y productos.</p>
        </div>

        <div className="space-y-3">
          {[
            ['Tienda ingresos', fmt(storeRevenue)],
            ['Tienda neto', fmt(storeNetRevenue)],
            ['Productos netos', fmt(productRevenue)],
            ['Gap vs neto', fmt(netGap)],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
              <span className="text-app-secondary text-[12px]">{label}</span>
              <span className="text-white text-[13px] font-semibold">{value}</span>
            </div>
          ))}
        </div>

        <p className="text-app-secondary text-[12px] mt-4">
          Productos distribuye descuentos sobre los ítems, pero no representa envío ni todos los ajustes del pedido. El cierre útil es primero contra <span className="text-white">net revenue</span>.
        </p>
        <p className="text-app-secondary text-[12px] mt-2">
          Gap contra ingresos brutos: <span className="text-white">{fmt(grossGap)}</span>
        </p>
      </div>
    </div>
  );
}

// Parser CSV simple. No maneja quoted strings con comas internas, alcanza para los templates planos.
function parseCSVPreview(text, maxRows = 50) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [], totalRows: 0 };
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
    return obj;
  });
  return { headers, rows: rows.slice(0, maxRows), totalRows: rows.length };
}

function CSVUploadSection({ storeId, onUploaded }) {
  const fileRef = useRef();
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    setResult(null);
    if (!file) {
      setSelectedFile(null);
      setPreview(null);
      return;
    }
    setSelectedFile(file);
    try {
      const text = await file.text();
      const parsed = parseCSVPreview(text, 50);
      setPreview(parsed);
    } catch {
      setPreview({ headers: [], rows: [], totalRows: 0, error: 'No se pudo leer el archivo.' });
    }
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0] || selectedFile;
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('effectiveFrom', effectiveFrom);
    try {
      const { data } = await api.post(
        `/api/stores/${storeId}/products/costs`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setResult(data);
      if (fileRef.current) fileRef.current.value = '';
      setSelectedFile(null);
      setPreview(null);
      if (onUploaded) onUploaded();
    } catch (err) {
      setResult({ error: err.response?.data?.error || 'Error' });
    }
    setUploading(false);
  };

  const cancelPreview = () => {
    if (fileRef.current) fileRef.current.value = '';
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
  };

  const downloadTemplate = (type) => {
    window.open(`/api/stores/${storeId}/products/costs/template?type=${type}`, '_blank');
  };

  return (
    <div className="card p-5">
      <p className="kpi-label mb-4">Importar costos de productos (CSV)</p>

      <div className="flex flex-wrap gap-2 mb-4">
        {['productos', 'comisiones', 'envio', 'adicionales'].map((t) => (
          <button
            key={t}
            onClick={() => downloadTemplate(t)}
            className="chip"
          >
            Plantilla {t}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="date"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
          className="input-dark"
        />
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="text-[12px] text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[12px] file:font-medium file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 file:transition"
        />
        <button
          onClick={handleUpload}
          disabled={uploading || !preview || preview.error}
          className="btn-primary disabled:opacity-50"
        >
          {uploading ? 'Subiendo...' : 'Confirmar e importar'}
        </button>
        {preview && (
          <button onClick={cancelPreview} className="btn-ghost text-[12px]">
            Cancelar
          </button>
        )}
      </div>

      {preview && !preview.error && (
        <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-semibold text-white">
              Vista previa — {preview.totalRows} {preview.totalRows === 1 ? 'fila' : 'filas'} detectadas
            </p>
            <p className="text-[11px] text-gray-500">
              Mostrando primeras {Math.min(preview.totalRows, 10)} · vigencia desde {effectiveFrom}
            </p>
          </div>
          {preview.headers.length === 0 ? (
            <p className="text-[12px] text-amber-300">El archivo está vacío.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-app-muted">
                    {preview.headers.map((h) => (
                      <th key={h} className="text-left font-semibold uppercase tracking-wider text-[10px] py-1 px-2 border-b border-white/[0.06]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      {preview.headers.map((h) => (
                        <td key={h} className="py-1 px-2 text-app-primary border-b border-white/[0.03] truncate max-w-[160px]">{row[h] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.totalRows > 10 && (
                <p className="text-[11px] text-gray-500 mt-2">+ {preview.totalRows - 10} filas más se importan al confirmar.</p>
              )}
            </div>
          )}
        </div>
      )}

      {preview?.error && <p className="mt-3 text-[12px] text-red-400">{preview.error}</p>}

      {result && !result.error && (
        <div className="mt-3 space-y-1">
          <p className="text-[12px] text-emerald-400">
            Actualizados: {result.updated} · Vigencia: {effectiveFrom}
            {result.notFound?.length > 0 && ` | No encontrados: ${result.notFound.length}`}
          </p>
          {result.notFound?.length > 0 && (
            <details className="text-[11px] text-amber-300">
              <summary className="cursor-pointer hover:text-amber-200">Ver SKUs no encontrados ({result.notFound.length})</summary>
              <p className="mt-1 text-app-muted break-all">{result.notFound.join(', ')}</p>
            </details>
          )}
          {result.invalidRows?.length > 0 && (
            <details className="text-[11px] text-amber-400">
              <summary className="cursor-pointer hover:text-amber-300">Ver filas inválidas ({result.invalidRows.length})</summary>
              <p className="mt-1 text-app-muted break-all">{result.invalidRows.join(' | ')}</p>
            </details>
          )}
        </div>
      )}
      {result?.error && <p className="mt-3 text-[12px] text-red-400">{result.error}</p>}
    </div>
  );
}

function FixedCostsSection({ storeId, onChanged }) {
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    categoria: 'general',
    monto: '',
    cadence: 'monthly',
    periodStart: '',
    periodEnd: '',
    notes: '',
  });

  const loadItems = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/stores/${storeId}/fixed-costs`);
      setItems(data);
    } catch {
      setItems([]);
    }
  }, [storeId]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const submit = async () => {
    if (!form.nombre.trim() || !form.monto) return;
    setSaving(true);
    try {
      await api.post(`/api/stores/${storeId}/fixed-costs`, {
        ...form,
        monto: Number(form.monto),
        periodStart: form.periodStart || undefined,
        periodEnd: form.periodEnd || undefined,
      });
      setForm({
        nombre: '',
        categoria: 'general',
        monto: '',
        cadence: 'monthly',
        periodStart: '',
        periodEnd: '',
        notes: '',
      });
      await loadItems();
      onChanged?.();
    } catch {}
    setSaving(false);
  };

  const remove = async (id) => {
    try {
      await api.delete(`/api/stores/${storeId}/fixed-costs/${id}`);
      await loadItems();
      onChanged?.();
    } catch {}
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="kpi-label">Costos fijos</p>
        <span className="text-app-secondary text-[12px]">{items.length} activos</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
        <input
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          placeholder="Nombre"
          className="input-dark"
        />
        <input
          value={form.categoria}
          onChange={(e) => setForm({ ...form, categoria: e.target.value })}
          placeholder="Categoría"
          className="input-dark"
        />
        <input
          type="number"
          value={form.monto}
          onChange={(e) => setForm({ ...form, monto: e.target.value })}
          placeholder="Monto"
          className="input-dark"
        />
        <select
          value={form.cadence}
          onChange={(e) => setForm({ ...form, cadence: e.target.value })}
          className="input-dark"
        >
          <option value="monthly">Mensual</option>
          <option value="weekly">Semanal</option>
          <option value="daily">Diario</option>
          <option value="one_time">Una vez</option>
        </select>
        <input
          type="date"
          value={form.periodStart}
          onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
          className="input-dark"
        />
        <input
          type="date"
          value={form.periodEnd}
          onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
          className="input-dark"
        />
      </div>

      <textarea
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
        placeholder="Notas"
        className="input-dark w-full min-h-[84px] mb-3"
      />

      <button onClick={submit} disabled={saving} className="btn-primary disabled:opacity-50">
        {saving ? 'Guardando...' : 'Agregar costo fijo'}
      </button>

      <div className="mt-5 space-y-2">
        {items.length === 0 ? (
          <p className="text-app-secondary text-[12px]">Todavía no hay costos fijos cargados.</p>
        ) : (
          items.map((item) => (
            <div key={item._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
              <div className="min-w-0">
                <p className="text-white text-[13px] font-medium">{item.nombre}</p>
                <p className="text-app-secondary text-[11px]">
                  {item.categoria || 'general'} · {item.cadence} · {fmt(item.monto)}
                </p>
              </div>
              <button onClick={() => remove(item._id)} className="btn-ghost text-[12px]">
                Archivar
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Costos() {
  const { storeId } = useParams();
  const { from, to } = useSelector((s) => s.date);
  const coverage = useSelector((s) => s.stores.metrics[storeId]?.costCoverage || null);
  const [pnl, setPnl] = useState(null);
  const [breakeven, setBreakeven] = useState(null);
  const [financialConsistency, setFinancialConsistency] = useState(null);
  const [productOverview, setProductOverview] = useState(null);
  const [storeMetrics, setStoreMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const [pnlRes, beRes, consistencyRes, productOverviewRes, metricsRes] = await Promise.all([
        api.get(`/api/stores/${storeId}/pnl`, { params }),
        api.get(`/api/stores/${storeId}/breakeven`, { params }),
        api.get(`/api/stores/${storeId}/financial-consistency`, { params }),
        api.get(`/api/stores/${storeId}/products/overview`, { params }),
        api.get(`/api/stores/${storeId}/metrics`, { params }),
      ]);
      setPnl(pnlRes.data);
      setBreakeven(beRes.data);
      setFinancialConsistency(consistencyRes.data);
      setProductOverview(productOverviewRes.data);
      setStoreMetrics(metricsRes.data);
    } catch {
      setPnl(null);
      setBreakeven(null);
      setFinancialConsistency(null);
      setProductOverview(null);
      setStoreMetrics(null);
    }
    setLoading(false);
  }, [storeId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="text-center py-12 text-gray-600 text-[13px]">Cargando costos...</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Costos & P&L</h1>
        <p className="page-subtitle">Análisis de rentabilidad y punto de equilibrio del período.</p>
      </div>

      <CostCatalogSection overview={productOverview} metrics={storeMetrics} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PnLSection pnl={pnl} />
        <FinancialConsistencySection data={financialConsistency} coverage={coverage} storeId={storeId} />
        <BreakevenSection be={breakeven} />
      </div>

      <FixedCostsSection storeId={storeId} onChanged={fetchData} />

      <CostsWizard storeId={storeId} onUploaded={fetchData} />

      <CSVUploadSection storeId={storeId} onUploaded={fetchData} />

      <AIAnalysisPanel storeId={storeId} section="costos" from={from} to={to} />
    </div>
  );
}
