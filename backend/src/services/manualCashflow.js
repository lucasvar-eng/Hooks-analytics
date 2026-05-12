const mongoose = require('mongoose');
const CashflowManualEntry = require('../models/CashflowManualEntry');
const BankAccountBalance = require('../models/BankAccountBalance');
const CashflowEntry = require('../models/CashflowEntry');

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isoDate(d) {
  return startOfDay(d).toISOString().slice(0, 10);
}

/**
 * Lista movimientos manuales filtrados.
 */
async function listEntries({ storeId, type, category, estado, from, to }) {
  const match = { storeId: new mongoose.Types.ObjectId(storeId) };
  if (type) match.type = type;
  if (category) match.category = category;
  if (estado) match.estado = estado;
  if (from || to) {
    match.fechaPrevista = {};
    if (from) match.fechaPrevista.$gte = startOfDay(from);
    if (to) match.fechaPrevista.$lte = new Date(to + 'T23:59:59.999Z');
  }
  return CashflowManualEntry.find(match).sort({ fechaPrevista: 1 }).lean();
}

/**
 * Crea / actualiza una entrada manual. Si tiene recurrencia, expande
 * en N entradas hasta `until` o 12 meses por default.
 */
async function upsertEntry({ storeId, userId, payload }) {
  const data = {
    storeId,
    type: payload.type,
    category: payload.category,
    concepto: payload.concepto,
    monto: Math.abs(Number(payload.monto || 0)),
    fechaPrevista: payload.fechaPrevista ? new Date(payload.fechaPrevista) : new Date(),
    fechaEfectiva: payload.fechaEfectiva ? new Date(payload.fechaEfectiva) : undefined,
    estado: payload.estado || 'previsto',
    contraparte: payload.contraparte || '',
    medio: payload.medio || '',
    notes: payload.notes || '',
    createdBy: userId,
    recurrente: payload.recurrente || { active: false },
  };

  if (payload._id) {
    return CashflowManualEntry.findOneAndUpdate(
      { _id: payload._id, storeId },
      { $set: data },
      { new: true }
    ).lean();
  }

  // Crear: si recurrente, generar entries futuras
  if (data.recurrente?.active && data.recurrente?.cadence) {
    const entries = expandRecurrence(data);
    return CashflowManualEntry.insertMany(entries);
  }

  const created = await CashflowManualEntry.create(data);
  return created.toObject();
}

function expandRecurrence(base) {
  const entries = [base];
  const until = base.recurrente.until ? new Date(base.recurrente.until) : new Date(Date.now() + 365 * DAY_MS);
  let nextDate = new Date(base.fechaPrevista);
  const cadence = base.recurrente.cadence;

  // Hard limit de 60 iteraciones para evitar bucle si until es muy lejano
  for (let i = 0; i < 60; i++) {
    nextDate = advanceDate(nextDate, cadence);
    if (nextDate > until) break;
    entries.push({ ...base, fechaPrevista: new Date(nextDate) });
  }
  return entries;
}

function advanceDate(date, cadence) {
  const d = new Date(date);
  switch (cadence) {
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'semiannual': d.setMonth(d.getMonth() + 6); break;
    case 'annual': d.setFullYear(d.getFullYear() + 1); break;
    default: d.setMonth(d.getMonth() + 1);
  }
  return d;
}

async function deleteEntry({ storeId, id }) {
  await CashflowManualEntry.deleteOne({ _id: id, storeId });
  return { ok: true };
}

/**
 * Saldos bancarios del store (no archivados).
 */
async function listAccounts(storeId) {
  return BankAccountBalance.find({
    storeId: new mongoose.Types.ObjectId(storeId),
    archived: false,
  }).sort({ type: 1, nombre: 1 }).lean();
}

async function upsertAccount({ storeId, userId, payload }) {
  const data = {
    storeId,
    type: payload.type,
    nombre: payload.nombre,
    saldo: Number(payload.saldo || 0),
    saldoUpdatedAt: new Date(),
    fechaVencimiento: payload.fechaVencimiento ? new Date(payload.fechaVencimiento) : undefined,
    notes: payload.notes || '',
    createdBy: userId,
  };

  if (payload._id) {
    return BankAccountBalance.findOneAndUpdate(
      { _id: payload._id, storeId },
      { $set: data },
      { new: true }
    ).lean();
  }
  const created = await BankAccountBalance.create(data);
  return created.toObject();
}

async function archiveAccount({ storeId, id }) {
  await BankAccountBalance.findOneAndUpdate({ _id: id, storeId }, { $set: { archived: true } });
  return { ok: true };
}

/**
 * Forecast unificado por día durante N días desde hoy:
 *  - Ingresos TN (CashflowEntry liquidable pendiente)
 *  - Ingresos manuales previstos
 *  - Egresos manuales previstos
 *  - Saldo proyectado acumulado (suma desde el saldo actual de cuentas)
 *  - Detector de "cash gap" (días con saldo proyectado negativo)
 */
async function getUnifiedProjection({ storeId, days = 60 }) {
  const storeObjectId = new mongoose.Types.ObjectId(storeId);
  const today = startOfDay(new Date());
  const horizon = new Date(today.getTime() + days * DAY_MS);

  const [tnPendientes, manualEntries, accounts] = await Promise.all([
    CashflowEntry.find({
      storeId: storeObjectId,
      estado: 'pendiente',
      fechaPago: { $gte: today, $lte: horizon },
    }).select('fechaPago liquidable').lean(),
    // Incluye movimientos previstos vencidos (fecha < hoy) — se proyectan hoy
    // porque el usuario tiene una obligación pendiente que sigue impactando el saldo.
    CashflowManualEntry.find({
      storeId: storeObjectId,
      estado: { $in: ['previsto', 'confirmado'] },
      fechaPrevista: { $lte: horizon },
    }).lean(),
    BankAccountBalance.find({ storeId: storeObjectId, archived: false }).lean(),
  ]);

  // Saldo inicial: suma de cuentas líquidas (excluye cheques diferidos a pagar)
  const liquidTypes = ['cuenta-bancaria', 'billetera-digital', 'cheque-en-cartera', 'efectivo-caja'];
  const balanceStart = accounts
    .filter((a) => liquidTypes.includes(a.type))
    .reduce((s, a) => s + Number(a.saldo || 0), 0);

  // Index daily moves
  const byDay = new Map();
  const ensure = (d) => {
    if (!byDay.has(d)) byDay.set(d, { date: d, ingresoTN: 0, ingresoManual: 0, egresoManual: 0 });
    return byDay.get(d);
  };

  for (const e of tnPendientes) ensure(isoDate(e.fechaPago)).ingresoTN += Number(e.liquidable || 0);
  const todayKey = isoDate(today);
  for (const e of manualEntries) {
    const fechaKey = isoDate(e.fechaPrevista);
    // Movimientos vencidos previstos se cuentan en el día de hoy (la
    // obligación sigue pendiente y va a impactar el saldo cuando se ejecute)
    const key = fechaKey < todayKey ? todayKey : fechaKey;
    const cell = ensure(key);
    if (e.type === 'ingreso') cell.ingresoManual += Number(e.monto || 0);
    else cell.egresoManual += Number(e.monto || 0);
  }

  // Construir array secuencial día por día
  const projection = [];
  let saldo = balanceStart;
  let firstGap = null;
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() + i * DAY_MS);
    const key = isoDate(d);
    const day = byDay.get(key) || { date: key, ingresoTN: 0, ingresoManual: 0, egresoManual: 0 };
    const movimientoNeto = day.ingresoTN + day.ingresoManual - day.egresoManual;
    saldo += movimientoNeto;
    const inGap = saldo < 0;
    if (inGap && !firstGap) firstGap = { date: key, saldo, daysFromToday: i };
    projection.push({ ...day, movimientoNeto, saldoAcumulado: saldo, inGap });
  }

  // Totales
  const totalIngresoTN = projection.reduce((s, d) => s + d.ingresoTN, 0);
  const totalIngresoManual = projection.reduce((s, d) => s + d.ingresoManual, 0);
  const totalEgresoManual = projection.reduce((s, d) => s + d.egresoManual, 0);
  const saldoFinal = projection[projection.length - 1]?.saldoAcumulado || balanceStart;

  return {
    horizon: { from: isoDate(today), to: isoDate(horizon), days },
    balanceStart,
    accounts: { count: accounts.length, liquid: accounts.filter((a) => liquidTypes.includes(a.type)).length },
    totals: {
      ingresoTN: totalIngresoTN,
      ingresoManual: totalIngresoManual,
      egresoManual: totalEgresoManual,
      neto: totalIngresoTN + totalIngresoManual - totalEgresoManual,
      saldoFinal,
    },
    firstGap,
    projection,
  };
}

module.exports = {
  listEntries, upsertEntry, deleteEntry,
  listAccounts, upsertAccount, archiveAccount,
  getUnifiedProjection,
};
