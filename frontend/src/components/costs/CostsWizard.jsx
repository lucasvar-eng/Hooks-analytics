import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../../services/api';

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

// Convierte un array de { tnProductId, costoUnitario } a CSV con headers que reconoce el endpoint existente.
function buildCsv(rows) {
  const header = 'tnProductId,costoUnitario,costoEmpaque';
  const lines = rows
    .filter((r) => r.tnProductId && Number(r.costoUnitario) > 0)
    .map((r) => `${r.tnProductId},${Number(r.costoUnitario)},${Number(r.costoEmpaque) || 0}`);
  return [header, ...lines].join('\n');
}

export default function CostsWizard({ storeId, onUploaded }) {
  const { from, to } = useSelector((s) => s.date);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [totalWithoutCost, setTotalWithoutCost] = useState(0);
  const [costs, setCosts] = useState({}); // tnProductId → { costoUnitario, costoEmpaque }
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [limit] = useState(20);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.get(`/api/stores/${storeId}/products/cost-load-priority`, {
        params: { from, to, limit },
      });
      setItems(data.items || []);
      setTotalWithoutCost(data.totalWithoutCost || 0);
      setCosts({});
    } catch (err) {
      setResult({ error: err?.response?.data?.error || 'No se pudo cargar la priorización.' });
    } finally {
      setLoading(false);
    }
  }, [storeId, from, to, limit]);

  useEffect(() => {
    if (open && items.length === 0) load();
  }, [open, items.length, load]);

  const updateCost = (tnProductId, field, value) => {
    setCosts((prev) => ({
      ...prev,
      [tnProductId]: { ...prev[tnProductId], [field]: value },
    }));
  };

  const filledCount = Object.values(costs).filter((c) => Number(c?.costoUnitario) > 0).length;

  const handleSave = async () => {
    if (filledCount === 0) return;
    setSaving(true);
    setResult(null);
    const rows = Object.entries(costs)
      .filter(([, v]) => Number(v?.costoUnitario) > 0)
      .map(([tnProductId, v]) => ({ tnProductId, costoUnitario: v.costoUnitario, costoEmpaque: v.costoEmpaque || 0 }));
    const csv = buildCsv(rows);
    try {
      const blob = new Blob([csv], { type: 'text/csv' });
      const file = new File([blob], 'wizard-costos.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);
      formData.append('effectiveFrom', new Date().toISOString().slice(0, 10));
      const { data } = await api.post(`/api/stores/${storeId}/products/costs`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult({ ok: true, updated: data.updated, notFound: data.notFound, invalidRows: data.invalidRows });
      if (data.updated > 0) {
        // Refrescar la lista (los recién cargados ya no aparecen).
        await load();
        if (onUploaded) onUploaded();
      }
    } catch (err) {
      setResult({ error: err?.response?.data?.error || 'Error al guardar los costos.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="kpi-label">Wizard de costos · top sellers</p>
          <p className="text-app-secondary text-[12px] mt-1">
            Cargá los costos de los productos que más facturaron en el período. {totalWithoutCost > 0 && (
              <>Hay <strong className="text-app-primary">{totalWithoutCost}</strong> productos sin costo cargado.</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="btn-secondary text-[12px]"
        >
          {open ? 'Ocultar' : 'Cargar top sellers'}
        </button>
      </div>

      {open && (
        <>
          {loading && <p className="text-[12px] text-app-secondary py-4 text-center">Cargando productos sin costo...</p>}
          {!loading && items.length === 0 && (
            <p className="text-[12px] text-emerald-300 py-4 text-center">
              Todos los productos del período ya tienen costo cargado.
            </p>
          )}
          {!loading && items.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-app-muted">
                      <th className="text-left px-3 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold">Producto</th>
                      <th className="text-right px-3 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold">Precio</th>
                      <th className="text-right px-3 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold">Vendido</th>
                      <th className="text-right px-3 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold">Revenue</th>
                      <th className="text-right px-3 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold">Stock</th>
                      <th className="text-right px-3 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold w-[120px]">Costo unitario</th>
                      <th className="text-right px-3 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold w-[100px]">Empaque</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr key={p.tnProductId} className="border-t border-white/[0.04]">
                        <td className="px-3 py-2 text-app-primary max-w-[280px] truncate" title={p.nombre}>
                          <span className="text-app-muted text-[10px] mr-1.5">#{p.tnProductId}</span>
                          {p.nombre}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(p.precio)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.periodUnits || '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-app-primary">{p.periodRevenue ? fmtMoney(p.periodRevenue) : '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.stock}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={costs[p.tnProductId]?.costoUnitario || ''}
                            onChange={(e) => updateCost(p.tnProductId, 'costoUnitario', e.target.value)}
                            className="input-dark w-full text-right tabular-nums"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={costs[p.tnProductId]?.costoEmpaque || ''}
                            onChange={(e) => updateCost(p.tnProductId, 'costoEmpaque', e.target.value)}
                            className="input-dark w-full text-right tabular-nums"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[11px] text-app-secondary">
                  {filledCount > 0
                    ? `${filledCount} de ${items.length} listos para guardar`
                    : 'Completá al menos un costo unitario'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={load}
                    disabled={loading || saving}
                    className="btn-ghost text-[12px] disabled:opacity-50"
                  >
                    Refrescar lista
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || filledCount === 0}
                    className="btn-primary disabled:opacity-50"
                  >
                    {saving ? 'Guardando...' : `Guardar ${filledCount} ${filledCount === 1 ? 'costo' : 'costos'}`}
                  </button>
                </div>
              </div>
            </>
          )}

          {result?.ok && (
            <p className="mt-3 text-[12px] text-emerald-400">
              Se cargaron {result.updated} {result.updated === 1 ? 'costo' : 'costos'} correctamente.
              {result.notFound?.length > 0 && ` ${result.notFound.length} SKUs no encontrados.`}
              {result.invalidRows?.length > 0 && ` ${result.invalidRows.length} filas inválidas.`}
            </p>
          )}
          {result?.error && (
            <p className="mt-3 text-[12px] text-red-400">{result.error}</p>
          )}
        </>
      )}
    </div>
  );
}
