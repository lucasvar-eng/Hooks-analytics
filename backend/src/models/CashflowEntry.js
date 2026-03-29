const mongoose = require('mongoose');

const cashflowEntrySchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },

    fechaCreacion: { type: Date, required: true }, // order creation date
    fechaPago: { type: Date, required: true },     // estimated payment/credit date
    estado: { type: String, enum: ['pendiente', 'recibido'], default: 'pendiente' },

    totalOrden: { type: Number, default: 0 },   // portion of order total for this installment
    liquidable: { type: Number, default: 0 },    // amount after commissions
    comision: { type: Number, default: 0 },      // commission portion for this installment

    gateway: { type: String },
    cuotas: { type: Number, default: 1 },
    numeroCuota: { type: Number, default: 1 },
  },
  { timestamps: true }
);

cashflowEntrySchema.index({ storeId: 1, fechaPago: 1 });
cashflowEntrySchema.index({ storeId: 1, estado: 1 });
cashflowEntrySchema.index({ orderId: 1 });

module.exports = mongoose.model('CashflowEntry', cashflowEntrySchema);
