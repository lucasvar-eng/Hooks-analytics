import { useState, useEffect } from 'react';
import api from '../../services/api';

/**
 * Panel para configurar comisiones, impuestos y fee de plataforma.
 *
 * Persiste:
 *   - store.tasaIBB                 (% IBB por orden)
 *   - store.feePlataformaPct        (% fee TN por orden)
 *   - store.comisionPagoConfig[]    ({ medioPago, cuotas, comisionBase, comisionCuotas })
 *
 * Endpoint: PUT /api/stores/:id/costos (ya existente en costosController.updateCostos).
 */

const MEDIOS_PAGO_SUGERIDOS = ['mercadopago', 'visa', 'mastercard', 'amex', 'naranja', 'cabal', 'efectivo', 'transferencia'];

function emptyRow() {
  return { medioPago: '', cuotas: 1, comisionBase: '', comisionCuotas: 0 };
}

export default function CommissionsPanel({ storeId, onChanged }) {
  const [tasaIBB, setTasaIBB] = useState('');
  const [feePlataformaPct, setFeePlataformaPct] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/api/stores/${storeId}`);
        if (cancelled) return;
        setTasaIBB(data?.tasaIBB != null ? String(data.tasaIBB) : '');
        setFeePlataformaPct(data?.feePlataformaPct != null ? String(data.feePlataformaPct) : '');
        setRows(Array.isArray(data?.comisionPagoConfig) && data.comisionPagoConfig.length > 0
          ? data.comisionPagoConfig.map(normalizeRow)
          : [emptyRow()]);
      } catch {
        if (!cancelled) {
          setRows([emptyRow()]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId]);

  const updateRow = (idx, field, value) => {
    setRows((curr) => curr.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };
  const addRow = () => setRows((curr) => [...curr, emptyRow()]);
  const removeRow = (idx) => setRows((curr) => curr.filter((_, i) => i !== idx));

  const save = async () => {
    setSaving(true);
    setSavedAt(null);
    try {
      const cleanedRows = rows
        .filter((r) => r.medioPago && Number(r.comisionBase) >= 0)
        .map((r) => ({
          medioPago: r.medioPago.trim().toLowerCase(),
          cuotas: Number(r.cuotas) || 1,
          comisionBase: Number(r.comisionBase) || 0,
          comisionCuotas: Number(r.comisionCuotas) || 0,
        }));
      await api.put(`/api/stores/${storeId}/costos`, {
        tasaIBB: tasaIBB === '' ? 0 : Number(tasaIBB),
        feePlataformaPct: feePlataformaPct === '' ? 0 : Number(feePlataformaPct),
        comisionPagoConfig: cleanedRows,
      });
      setSavedAt(new Date());
      onChanged?.();
    } catch {
      // El backend ya loguea; mostramos el resultado igual con onChanged refresh.
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-[12px] text-gray-300 py-4 text-center">Cargando configuración...</p>;
  }

  const filledRows = rows.filter((r) => r.medioPago && Number(r.comisionBase) >= 0).length;

  return (
    <div className="space-y-5">
      {/* Globales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-[1.5px] text-gray-300 mb-1.5">
            Ingresos brutos (IBB)
          </span>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              max="20"
              value={tasaIBB}
              onChange={(e) => setTasaIBB(e.target.value)}
              placeholder="0"
              className="input-dark pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-300">%</span>
          </div>
          <span className="block text-[11px] text-gray-300 mt-1">% sobre cada orden facturada</span>
        </label>

        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-[1.5px] text-gray-300 mb-1.5">
            Fee de plataforma (Tienda Nube)
          </span>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              max="20"
              value={feePlataformaPct}
              onChange={(e) => setFeePlataformaPct(e.target.value)}
              placeholder="0"
              className="input-dark pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-gray-300">%</span>
          </div>
          <span className="block text-[11px] text-gray-300 mt-1">% que cobra TN por cada venta</span>
        </label>
      </div>

      {/* Comisiones por medio de pago */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-gray-300">Comisiones por medio de pago</p>
            <p className="text-[11px] text-gray-300 mt-0.5">% que cobra cada gateway. Para cuotas, sumá el recargo del plan.</p>
          </div>
          <button type="button" onClick={addRow} className="btn-ghost text-[12px]">
            + Agregar fila
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-gray-300">
                <th className="text-left px-3 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold w-[28%]">Medio de pago</th>
                <th className="text-right px-3 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold w-[15%]">Cuotas</th>
                <th className="text-right px-3 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold w-[22%]">Comisión base %</th>
                <th className="text-right px-3 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold w-[22%]">Recargo cuotas %</th>
                <th className="w-[13%]"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-t border-white/[0.04]">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      list={`medios-pago-list`}
                      value={row.medioPago}
                      onChange={(e) => updateRow(idx, 'medioPago', e.target.value)}
                      placeholder="mercadopago"
                      className="input-dark"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={row.cuotas}
                      onChange={(e) => updateRow(idx, 'cuotas', e.target.value)}
                      className="input-dark text-right tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.comisionBase}
                      onChange={(e) => updateRow(idx, 'comisionBase', e.target.value)}
                      placeholder="0"
                      className="input-dark text-right tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.comisionCuotas}
                      onChange={(e) => updateRow(idx, 'comisionCuotas', e.target.value)}
                      placeholder="0"
                      className="input-dark text-right tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="text-[11px] text-gray-300 hover:text-red-400 transition"
                        title="Eliminar fila"
                      >
                        Quitar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <datalist id="medios-pago-list">
          {MEDIOS_PAGO_SUGERIDOS.map((m) => <option key={m} value={m} />)}
        </datalist>
        <p className="text-[11px] text-gray-300 mt-2">
          Ejemplo: <span className="text-gray-200">mercadopago · 3 cuotas · base 4,5% · recargo cuotas 8%</span>
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
        <p className="text-[12px] text-gray-200">
          {filledRows > 0
            ? `${filledRows} ${filledRows === 1 ? 'medio configurado' : 'medios configurados'}`
            : 'Sin medios configurados — agregá al menos uno'}
        </p>
        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="text-[11px] text-emerald-400">
              Guardado · {savedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizeRow(r) {
  return {
    medioPago: r.medioPago || '',
    cuotas: r.cuotas != null ? Number(r.cuotas) : 1,
    comisionBase: r.comisionBase != null ? String(r.comisionBase) : '',
    comisionCuotas: r.comisionCuotas != null ? Number(r.comisionCuotas) : 0,
  };
}
