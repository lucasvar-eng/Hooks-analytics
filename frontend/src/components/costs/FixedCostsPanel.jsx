import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

/**
 * Panel para CRUD de costos fijos del store. Form arriba + lista debajo.
 * Extraído del bloque FixedCostsSection que vivía dentro de pages/Costos.jsx.
 */
function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  return `$${Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

const CADENCE_LABELS = {
  monthly: 'Mensual',
  weekly: 'Semanal',
  daily: 'Diario',
  one_time: 'Una vez',
};

export default function FixedCostsPanel({ storeId, onChanged }) {
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadItems = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/stores/${storeId}/fixed-costs`);
      setItems(Array.isArray(data) ? data : []);
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
      setForm(emptyForm());
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-gray-200">{items.length} costos fijos activos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <input
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          placeholder="Nombre (ej. Alquiler)"
          className="input-dark"
        />
        <input
          value={form.categoria}
          onChange={(e) => setForm({ ...form, categoria: e.target.value })}
          placeholder="Categoría (ej. operativo)"
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
        placeholder="Notas (opcional)"
        className="input-dark w-full min-h-[68px]"
      />

      <button onClick={submit} disabled={saving || !form.nombre.trim() || !form.monto} className="btn-primary disabled:opacity-50">
        {saving ? 'Guardando...' : 'Agregar costo fijo'}
      </button>

      <div className="space-y-2 pt-2">
        {items.length === 0 ? (
          <p className="text-gray-200 text-[12px] py-3 text-center">Todavía no hay costos fijos cargados.</p>
        ) : (
          items.map((item) => (
            <div
              key={item._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3"
            >
              <div className="min-w-0">
                <p className="text-white text-[13px] font-semibold">{item.nombre}</p>
                <p className="text-gray-300 text-[11px] mt-0.5">
                  {item.categoria || 'general'} · {CADENCE_LABELS[item.cadence] || item.cadence} · {fmtMoney(item.monto)}
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

function emptyForm() {
  return {
    nombre: '',
    categoria: 'general',
    monto: '',
    cadence: 'monthly',
    periodStart: '',
    periodEnd: '',
    notes: '',
  };
}
