/**
 * Panel de saldos bancarios — el "snapshot del momento" de cuánta plata
 * tenés HOY. Cuentas líquidas separadas de cheques diferidos para que
 * el total real esté claro.
 */

import { useState } from 'react';

const TYPE_GROUPS = {
  liquid: ['cuenta-bancaria', 'billetera-digital', 'cheque-en-cartera', 'efectivo-caja'],
  diferidos: ['cheque-diferido-cobrar', 'cheque-diferido-pagar'],
  pasivos: ['tarjeta-credito-saldo'],
};

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '$0';
  const n = Number(v);
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString('es-AR')}`;
}

function fmtMoneyShort(v) {
  if (v == null || isNaN(v)) return '$0';
  const n = Number(v);
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}

function relativeAge(date) {
  if (!date) return 'sin fecha';
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} sem`;
  return `hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? 'es' : ''}`;
}

export default function BankBalancesPanel({ accounts = [], categories, onUpsert, onArchive }) {
  const [editing, setEditing] = useState(null); // null o el account a editar (o {} para nuevo)

  const totalLiquid = accounts
    .filter((a) => TYPE_GROUPS.liquid.includes(a.type))
    .reduce((s, a) => s + Number(a.saldo || 0), 0);
  const totalCheques = accounts
    .filter((a) => a.type === 'cheque-diferido-cobrar')
    .reduce((s, a) => s + Number(a.saldo || 0), 0);
  const totalPagar = accounts
    .filter((a) => a.type === 'cheque-diferido-pagar' || a.type === 'tarjeta-credito-saldo')
    .reduce((s, a) => s + Number(a.saldo || 0), 0);

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h3 className="text-white text-[15px] font-semibold">Saldos del momento</h3>
          <p className="text-app-secondary text-[12px] mt-1">
            Plata que tenés hoy en cuentas + cheques pendientes (a cobrar / a pagar). Editá el saldo cuando refresques los datos.
          </p>
        </div>
        <button
          onClick={() => setEditing({})}
          className="bg-blue-500/15 text-blue-200 border border-blue-500/30 px-3.5 py-2 rounded-md text-[12px] font-semibold hover:bg-blue-500/25"
        >
          + Agregar cuenta
        </button>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <SummaryTile label="Líquido disponible" value={fmtMoney(totalLiquid)} sub={`${accounts.filter((a) => TYPE_GROUPS.liquid.includes(a.type)).length} cuentas`} accent="emerald" />
        <SummaryTile label="Cheques a cobrar" value={fmtMoney(totalCheques)} sub={`${accounts.filter((a) => a.type === 'cheque-diferido-cobrar').length} cheques`} accent="blue" />
        <SummaryTile label="Por pagar" value={fmtMoney(totalPagar)} sub="Cheques diferidos + tarjetas" accent="red" />
      </div>

      {/* Lista de cuentas agrupadas */}
      {accounts.length === 0 ? (
        <div className="p-8 rounded-lg border border-dashed border-white/[0.08] text-center">
          <p className="text-white text-[13px] font-medium">Sin cuentas cargadas todavía</p>
          <p className="text-app-secondary text-[12px] mt-2">Agregá tu cuenta bancaria, billetera digital o cheques pendientes para que el cashflow proyecte el saldo real.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {accounts.map((a) => (
            <AccountRow
              key={a._id}
              account={a}
              label={categories?.accountTypeLabels?.[a.type] || a.type}
              onEdit={() => setEditing(a)}
              onArchive={() => onArchive(a._id)}
            />
          ))}
        </div>
      )}

      {editing != null && (
        <AccountEditModal
          account={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSave={(payload) => { onUpsert(payload); setEditing(null); }}
        />
      )}
    </div>
  );
}

function SummaryTile({ label, value, sub, accent }) {
  const accentClass = accent === 'emerald' ? 'text-emerald-300'
    : accent === 'red' ? 'text-red-300'
    : 'text-blue-300';
  return (
    <div className="rounded-lg bg-white/[0.025] border border-white/[0.05] p-4">
      <p className="text-app-muted text-[10px] uppercase tracking-[0.16em] font-semibold">{label}</p>
      <p className={`text-[20px] font-bold tabular-nums leading-none mt-2 ${accentClass}`}>{value}</p>
      {sub && <p className="text-app-muted text-[11px] mt-1.5">{sub}</p>}
    </div>
  );
}

function AccountRow({ account, label, onEdit, onArchive }) {
  const isPasivo = account.type === 'cheque-diferido-pagar' || account.type === 'tarjeta-credito-saldo';
  return (
    <div
      onClick={onEdit}
      className="grid grid-cols-[180px,1fr,auto,auto] gap-4 items-center px-4 py-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition border border-transparent hover:border-white/[0.06]"
    >
      <span className="text-app-muted text-[11px] uppercase tracking-[0.14em] font-semibold">{label}</span>
      <div className="min-w-0">
        <p className="text-white text-[13px] font-medium truncate">{account.nombre}</p>
        {account.notes && <p className="text-app-muted text-[11px] mt-0.5 truncate">{account.notes}</p>}
      </div>
      <div className="text-right">
        <p className={`text-[15px] font-bold tabular-nums leading-none ${isPasivo ? 'text-red-300' : 'text-white'}`}>
          {isPasivo ? '−' : ''}{fmtMoney(Math.abs(account.saldo))}
        </p>
        <p className="text-app-muted text-[10px] mt-1">{relativeAge(account.saldoUpdatedAt)}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); if (window.confirm(`¿Archivar "${account.nombre}"?`)) onArchive(); }}
        className="text-app-muted hover:text-red-300 text-[14px] px-2"
        title="Archivar"
      >
        ×
      </button>
    </div>
  );
}

function AccountEditModal({ account, categories, onClose, onSave }) {
  const [form, setForm] = useState({
    _id: account._id,
    type: account.type || 'cuenta-bancaria',
    nombre: account.nombre || '',
    saldo: account.saldo ?? 0,
    fechaVencimiento: account.fechaVencimiento ? new Date(account.fechaVencimiento).toISOString().slice(0, 10) : '',
    notes: account.notes || '',
  });
  const isCheque = form.type === 'cheque-diferido-cobrar' || form.type === 'cheque-diferido-pagar';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-[480px] rounded-xl border border-white/10 bg-[#0f0f12] shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white text-[15px] font-semibold mb-1">{account._id ? 'Editar cuenta' : 'Agregar cuenta'}</h3>
        <p className="text-app-secondary text-[12px] mb-4">El saldo se va a usar para proyectar el cashflow día por día.</p>

        <div className="space-y-3">
          <Field label="Tipo">
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-white"
            >
              {(categories?.accountTypes || []).map((t) => (
                <option key={t} value={t}>{categories?.accountTypeLabels?.[t] || t}</option>
              ))}
            </select>
          </Field>
          <Field label="Nombre / identificador">
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Banco Galicia CC, MP principal"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-white"
            />
          </Field>
          <Field label="Saldo actual">
            <input
              type="number"
              value={form.saldo}
              onChange={(e) => setForm((f) => ({ ...f, saldo: Number(e.target.value) }))}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-white tabular-nums"
            />
          </Field>
          {isCheque && (
            <Field label="Fecha de vencimiento del cheque">
              <input
                type="date"
                value={form.fechaVencimiento}
                onChange={(e) => setForm((f) => ({ ...f, fechaVencimiento: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-white"
              />
            </Field>
          )}
          <Field label="Notas (opcional)">
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-white"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="bg-transparent text-app-secondary border border-white/[0.12] px-3 py-2 rounded-md text-[12px] hover:text-white">
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.nombre.trim()}
            className="bg-blue-500 text-white px-4 py-2 rounded-md text-[12px] font-semibold disabled:opacity-40 hover:bg-blue-600"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-app-muted text-[10px] uppercase tracking-[0.14em] font-semibold block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
