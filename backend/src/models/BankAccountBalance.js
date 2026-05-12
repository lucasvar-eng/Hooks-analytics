const mongoose = require('mongoose');

/**
 * Saldos bancarios — snapshots editables por cuenta.
 *
 * Cada documento es una "cuenta" (banco, billetera, etc.) con el saldo
 * actual y el último update. Cuando el usuario actualiza el saldo, se
 * sobrescribe el valor — no hay histórico de snapshots (si después se
 * quiere, se puede agregar un BankBalanceSnapshot aparte).
 */

const ACCOUNT_TYPES = [
  'cuenta-bancaria',         // Banco tradicional
  'billetera-digital',       // MP, Naranja X, Ualá
  'cheque-en-cartera',       // Cheques recibidos para depositar
  'cheque-diferido-cobrar',  // A cobrar más adelante
  'cheque-diferido-pagar',   // A pagar más adelante (saldo negativo conceptualmente)
  'efectivo-caja',           // Caja chica / caja física
  'tarjeta-credito-saldo',   // Saldo a pagar a la tarjeta
];

const ACCOUNT_TYPE_LABELS = {
  'cuenta-bancaria': 'Cuenta bancaria',
  'billetera-digital': 'Billetera digital',
  'cheque-en-cartera': 'Cheques en cartera',
  'cheque-diferido-cobrar': 'Cheques diferidos a cobrar',
  'cheque-diferido-pagar': 'Cheques diferidos a pagar',
  'efectivo-caja': 'Efectivo / caja',
  'tarjeta-credito-saldo': 'Saldo tarjeta de crédito',
};

const bankAccountBalanceSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    type: { type: String, enum: ACCOUNT_TYPES, required: true },
    nombre: { type: String, required: true, trim: true },  // "Banco Galicia CC", "MP principal", etc.

    saldo: { type: Number, default: 0 },
    saldoUpdatedAt: { type: Date, default: Date.now },

    // Para cheques diferidos: fecha esperada de cobro/pago
    fechaVencimiento: { type: Date },

    notes: { type: String, default: '', trim: true },
    archived: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

bankAccountBalanceSchema.index({ storeId: 1, archived: 1 });
bankAccountBalanceSchema.index({ storeId: 1, type: 1 });

module.exports = mongoose.model('BankAccountBalance', bankAccountBalanceSchema);
module.exports.ACCOUNT_TYPES = ACCOUNT_TYPES;
module.exports.ACCOUNT_TYPE_LABELS = ACCOUNT_TYPE_LABELS;
