const mongoose = require('mongoose');

/**
 * Movimientos manuales de cashflow — todo lo que NO viene de Tiendanube/Meta
 * automático. Cubre egresos (pagos a proveedores, sueldos, impuestos),
 * ingresos no-TN (ventas en local, mayoristas, otros) y permite proyectar
 * cuándo va a ocurrir cada cobro/pago.
 *
 * Los saldos bancarios viven en BankAccountBalance (modelo aparte) porque
 * son snapshots editables, no movimientos.
 */

const CATEGORIES = [
  // Egresos
  'mercaderia',
  'sueldos',
  'cargas-sociales',
  'impuestos',
  'alquiler',
  'servicios',
  'prestamos',
  'marketing-externo',
  'retiros-socios',
  'otros-egresos',
  // Ingresos no-TN
  'venta-local',
  'mayorista-b2b',
  'devolucion-cobrada',
  'otros-ingresos',
];

const CATEGORY_LABELS = {
  'mercaderia': 'Pago a proveedores',
  'sueldos': 'Sueldos',
  'cargas-sociales': 'Cargas sociales',
  'impuestos': 'Impuestos',
  'alquiler': 'Alquiler',
  'servicios': 'Servicios',
  'prestamos': 'Préstamos / leasing',
  'marketing-externo': 'Marketing externo',
  'retiros-socios': 'Retiros de socios',
  'otros-egresos': 'Otros egresos',
  'venta-local': 'Venta en local físico',
  'mayorista-b2b': 'Venta mayorista / B2B',
  'devolucion-cobrada': 'Devolución cobrada',
  'otros-ingresos': 'Otros ingresos',
};

const EGRESO_CATEGORIES = ['mercaderia', 'sueldos', 'cargas-sociales', 'impuestos', 'alquiler', 'servicios', 'prestamos', 'marketing-externo', 'retiros-socios', 'otros-egresos'];

const cashflowManualEntrySchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    type: { type: String, enum: ['ingreso', 'egreso'], required: true },
    category: { type: String, enum: CATEGORIES, required: true },

    concepto: { type: String, required: true, trim: true },
    monto: { type: Number, required: true },

    fechaPrevista: { type: Date, required: true },  // cuándo se proyecta el movimiento
    fechaEfectiva: { type: Date },                   // cuándo realmente ocurrió (si confirmado)
    estado: { type: String, enum: ['previsto', 'confirmado', 'cancelado'], default: 'previsto' },

    contraparte: { type: String, trim: true },       // proveedor / cliente B2B / banco
    medio: { type: String, trim: true },             // banco, MP, efectivo, cheque, transferencia

    recurrente: {
      active: { type: Boolean, default: false },
      cadence: { type: String, enum: ['monthly', 'weekly', 'quarterly', 'semiannual', 'annual'] },
      until: { type: Date },
    },

    notes: { type: String, default: '', trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

cashflowManualEntrySchema.index({ storeId: 1, fechaPrevista: 1 });
cashflowManualEntrySchema.index({ storeId: 1, type: 1, estado: 1 });

module.exports = mongoose.model('CashflowManualEntry', cashflowManualEntrySchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.CATEGORY_LABELS = CATEGORY_LABELS;
module.exports.EGRESO_CATEGORIES = EGRESO_CATEGORIES;
