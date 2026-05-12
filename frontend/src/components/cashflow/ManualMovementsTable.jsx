/**
 * Tabla de movimientos manuales (ingresos no-TN y egresos). CRUD completo:
 *  - Crear (con recurrencia opcional para sueldos/alquiler/etc.)
 *  - Editar
 *  - Marcar como confirmado
 *  - Eliminar
 *  - Filtros por tipo, categoría, estado
 */

import { useMemo, useState } from 'react';

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '$0';
  return `$${Math.round(Number(v)).toLocaleString('es-AR')}`;
}

// Las fechas se manejan como YYYY-MM-DD para evitar timezone shifts. Esta
// función toma una fecha de Mongo (UTC ISO) y la formatea para mostrar.
function fmtDate(d) {
  if (!d) return '—';
  const x = new Date(d);
  const dd = String(x.getUTCDate()).padStart(2, '0');
  const mm = String(x.getUTCMonth() + 1).padStart(2, '0');
  const yy = x.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
}

function isOverdue(date) {
  if (!date) return false;
  // Comparar en UTC para no dejar que el timezone local marque un movimiento de hoy como vencido
  const x = new Date(date);
  const today = new Date();
  const todayKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
  const dateKey = `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
  return dateKey < todayKey;
}

const ESTADO_PILL = {
  previsto: { label: 'Previsto', bg: 'bg-blue-500/15 text-blue-300' },
  confirmado: { label: 'Confirmado', bg: 'bg-emerald-500/15 text-emerald-300' },
  cancelado: { label: 'Cancelado', bg: 'bg-white/[0.06] text-app-muted' },
};

export default function ManualMovementsTable({ entries = [], categories, onUpsert, onDelete }) {
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterEstado, setFilterEstado] = useState('all');
  const [editing, setEditing] = useState(null); // null o entry o {} para nuevo

  const filtered = useMemo(() => entries.filter((e) => {
    if (filterType !== 'all' && e.type !== filterType) return false;
    if (filterCategory !== 'all' && e.category !== filterCategory) return false;
    if (filterEstado !== 'all' && e.estado !== filterEstado) return false;
    return true;
  }), [entries, filterType, filterCategory, filterEstado]);

  const totalIngresos = filtered.filter((e) => e.type === 'ingreso').reduce((s, e) => s + Number(e.monto || 0), 0);
  const totalEgresos = filtered.filter((e) => e.type === 'egreso').reduce((s, e) => s + Number(e.monto || 0), 0);

  const cats = categories?.entryCategories || [];
  const labels = categories?.entryCategoryLabels || {};

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h3 className="text-white text-[15px] font-semibold">Movimientos manuales</h3>
          <p className="text-app-secondary text-[12px] mt-1">
            Cargá pagos a proveedores, sueldos, impuestos, ventas en local, etc. — todo lo que no viene automático de TN.
          </p>
        </div>
        <button
          onClick={() => setEditing({})}
          className="bg-blue-500/15 text-blue-200 border border-blue-500/30 px-3.5 py-2 rounded-md text-[12px] font-semibold hover:bg-blue-500/25"
        >
          + Nuevo movimiento
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/[0.05] flex-wrap">
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-md p-0.5">
          {[
            { value: 'all', label: 'Todos', count: entries.length },
            { value: 'ingreso', label: 'Ingresos', count: entries.filter((e) => e.type === 'ingreso').length },
            { value: 'egreso', label: 'Egresos', count: entries.filter((e) => e.type === 'egreso').length },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterType(opt.value)}
              className={`px-2.5 py-1.5 rounded text-[11px] font-medium transition ${
                filterType === opt.value ? 'bg-blue-500/20 text-blue-200' : 'text-app-secondary hover:text-white'
              }`}
            >
              {opt.label}<span className="ml-1.5 text-app-muted text-[10px] tabular-nums">{opt.count}</span>
            </button>
          ))}
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[12px] text-white"
        >
          <option value="all">Todas las categorías</option>
          {cats.map((c) => <option key={c} value={c}>{labels[c] || c}</option>)}
        </select>
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[12px] text-white"
        >
          <option value="all">Todos los estados</option>
          <option value="previsto">Previstos</option>
          <option value="confirmado">Confirmados</option>
          <option value="cancelado">Cancelados</option>
        </select>
        <div className="ml-auto flex gap-4 text-[12px] text-app-secondary">
          <span>Ingresos <span className="text-emerald-300 font-semibold tabular-nums">{fmtMoney(totalIngresos)}</span></span>
          <span>Egresos <span className="text-red-300 font-semibold tabular-nums">{fmtMoney(totalEgresos)}</span></span>
          <span>Neto <span className={`font-bold tabular-nums ${totalIngresos - totalEgresos >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            {fmtMoney(totalIngresos - totalEgresos)}
          </span></span>
        </div>
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center text-app-secondary text-[13px]">
          {entries.length === 0
            ? 'Todavía no hay movimientos manuales cargados. Empezá agregando el próximo pago a proveedor o sueldo.'
            : 'Ningún movimiento coincide con los filtros.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.14em] text-app-muted border-b border-white/[0.06]">
                <th className="text-left font-semibold pb-3 pr-3">Fecha</th>
                <th className="text-left font-semibold pb-3 pr-3">Concepto</th>
                <th className="text-left font-semibold pb-3 pr-3">Categoría</th>
                <th className="text-left font-semibold pb-3 pr-3">Contraparte</th>
                <th className="text-center font-semibold pb-3 px-3">Estado</th>
                <th className="text-right font-semibold pb-3 pr-3">Monto</th>
                <th className="text-right font-semibold pb-3 pr-2 w-[60px]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const overdue = e.estado === 'previsto' && isOverdue(e.fechaPrevista);
                return (
                  <tr
                    key={e._id}
                    onClick={() => setEditing(e)}
                    className="border-b border-white/[0.03] hover:bg-white/[0.015] cursor-pointer transition"
                  >
                    <td className="py-3 pr-3">
                      <p className={`tabular-nums ${overdue ? 'text-amber-300 font-semibold' : 'text-white'}`}>{fmtDate(e.fechaPrevista)}</p>
                      {overdue && <p className="text-amber-300 text-[10px] mt-0.5">vencido</p>}
                    </td>
                    <td className="py-3 pr-3 text-white">{e.concepto}</td>
                    <td className="py-3 pr-3 text-app-secondary">{labels[e.category] || e.category}</td>
                    <td className="py-3 pr-3 text-app-secondary">{e.contraparte || '—'}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-semibold ${ESTADO_PILL[e.estado]?.bg || 'bg-white/[0.06]'}`}>
                        {ESTADO_PILL[e.estado]?.label || e.estado}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <span className={`font-bold tabular-nums ${e.type === 'ingreso' ? 'text-emerald-300' : 'text-red-300'}`}>
                        {e.type === 'egreso' ? '−' : '+'}{fmtMoney(e.monto)}
                      </span>
                    </td>
                    <td className="py-3 pr-2 text-right">
                      <button
                        onClick={(ev) => { ev.stopPropagation(); if (window.confirm(`¿Eliminar "${e.concepto}"?`)) onDelete(e._id); }}
                        className="text-app-muted hover:text-red-300 text-[14px]"
                        title="Eliminar"
                      >×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing != null && (
        <EntryEditModal
          entry={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={(payload) => { onUpsert(payload); setEditing(null); }}
        />
      )}
    </div>
  );
}

function EntryEditModal({ entry, categories, onClose, onSave }) {
  const [form, setForm] = useState({
    _id: entry._id,
    type: entry.type || 'egreso',
    category: entry.category || (entry.type === 'ingreso' ? 'venta-local' : 'mercaderia'),
    concepto: entry.concepto || '',
    monto: entry.monto ?? 0,
    fechaPrevista: entry.fechaPrevista ? new Date(entry.fechaPrevista).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    fechaEfectiva: entry.fechaEfectiva ? new Date(entry.fechaEfectiva).toISOString().slice(0, 10) : '',
    estado: entry.estado || 'previsto',
    contraparte: entry.contraparte || '',
    medio: entry.medio || '',
    notes: entry.notes || '',
    recurrente: entry.recurrente || { active: false, cadence: 'monthly', until: '' },
  });

  const cats = categories?.entryCategories || [];
  const egresoCats = categories?.egresoCategories || [];
  const labels = categories?.entryCategoryLabels || {};
  const filteredCats = form.type === 'egreso' ? egresoCats : cats.filter((c) => !egresoCats.includes(c));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-[560px] max-h-[92vh] overflow-y-auto rounded-xl border border-white/10 bg-[#0f0f12] shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white text-[16px] font-semibold mb-1">{entry._id ? 'Editar movimiento' : 'Nuevo movimiento'}</h3>

        <div className="flex items-center gap-1 bg-white/[0.03] rounded-md p-0.5 my-4 w-fit">
          {[
            { value: 'egreso', label: 'Egreso', accent: 'text-red-300' },
            { value: 'ingreso', label: 'Ingreso', accent: 'text-emerald-300' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setForm((f) => ({ ...f, type: opt.value, category: opt.value === 'egreso' ? 'mercaderia' : 'venta-local' }))}
              className={`px-3.5 py-1.5 rounded text-[12px] font-semibold transition ${
                form.type === opt.value ? `bg-white/[0.07] ${opt.accent}` : 'text-app-secondary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría" full>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-white"
            >
              {filteredCats.map((c) => <option key={c} value={c}>{labels[c] || c}</option>)}
            </select>
          </Field>
          <Field label="Concepto" full>
            <input
              type="text"
              value={form.concepto}
              onChange={(e) => setForm((f) => ({ ...f, concepto: e.target.value }))}
              placeholder="Ej: Pago Salomon factura 4521"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-white"
            />
          </Field>
          <Field label="Monto">
            <input
              type="number"
              value={form.monto}
              onChange={(e) => setForm((f) => ({ ...f, monto: Number(e.target.value) }))}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-white tabular-nums"
            />
          </Field>
          <Field label="Fecha prevista">
            <input
              type="date"
              value={form.fechaPrevista}
              onChange={(e) => setForm((f) => ({ ...f, fechaPrevista: e.target.value }))}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-white"
            />
          </Field>
          <Field label="Contraparte (proveedor / cliente)">
            <input
              type="text"
              value={form.contraparte}
              onChange={(e) => setForm((f) => ({ ...f, contraparte: e.target.value }))}
              placeholder="Ej: Salomon SA"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-white"
            />
          </Field>
          <Field label="Medio (banco, MP, efectivo)">
            <input
              type="text"
              value={form.medio}
              onChange={(e) => setForm((f) => ({ ...f, medio: e.target.value }))}
              placeholder="Ej: Galicia CC"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-white"
            />
          </Field>
          <Field label="Estado" full>
            <select
              value={form.estado}
              onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-white"
            >
              <option value="previsto">Previsto (todavía no ocurrió)</option>
              <option value="confirmado">Confirmado (ya pasó)</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </Field>
          <Field label="Notas" full>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-white"
            />
          </Field>
        </div>

        {!entry._id && (
          <div className="mt-4 pt-4 border-t border-white/[0.05]">
            <label className="flex items-center gap-2 text-[12px] text-app-secondary mb-2.5">
              <input
                type="checkbox"
                checked={form.recurrente.active}
                onChange={(e) => setForm((f) => ({ ...f, recurrente: { ...f.recurrente, active: e.target.checked } }))}
                className="accent-blue-500"
              />
              Repetir periódicamente (sueldos, alquiler, etc.)
            </label>
            {form.recurrente.active && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cada">
                  <select
                    value={form.recurrente.cadence}
                    onChange={(e) => setForm((f) => ({ ...f, recurrente: { ...f.recurrente, cadence: e.target.value } }))}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-white"
                  >
                    <option value="weekly">Semana</option>
                    <option value="monthly">Mes</option>
                    <option value="quarterly">Trimestre</option>
                    <option value="semiannual">Semestre</option>
                    <option value="annual">Año</option>
                  </select>
                </Field>
                <Field label="Hasta (opcional)">
                  <input
                    type="date"
                    value={form.recurrente.until}
                    onChange={(e) => setForm((f) => ({ ...f, recurrente: { ...f.recurrente, until: e.target.value } }))}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-white"
                  />
                </Field>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-white/[0.05]">
          <button onClick={onClose} className="bg-transparent text-app-secondary border border-white/[0.12] px-3 py-2 rounded-md text-[12px] hover:text-white">
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.concepto.trim() || !form.monto}
            className="bg-blue-500 text-white px-4 py-2 rounded-md text-[12px] font-semibold disabled:opacity-40 hover:bg-blue-600"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, full }) {
  return (
    <label className={`block ${full ? 'col-span-2' : ''}`}>
      <span className="text-app-muted text-[10px] uppercase tracking-[0.14em] font-semibold block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
