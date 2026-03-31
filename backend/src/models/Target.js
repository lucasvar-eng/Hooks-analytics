const mongoose = require('mongoose');

const targetSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    phase: {
      type: String,
      enum: ['lanzamiento', 'crecimiento', 'escalamiento', 'optimizacion', 'mantenimiento'],
      default: 'crecimiento',
    },
    kpis: {
      roasTarget: Number,
      trueRoasTarget: Number,
      cpaMaximo: Number,
      trueCpaMaximo: Number,
      profitMarginMin: Number,
      aovTarget: Number,
      ncPctTarget: Number,
      conversionRateTarget: Number,
      tasaDevolucionMax: Number,
    },
    breakeven: {
      roasBreakeven: Number,
      cpaBreakeven: Number,
      aovMinimo: Number,
    },
    alertThresholds: {
      warningPct: { type: Number, default: 10 },
      criticalPct: { type: Number, default: 25 },
    },
    source: {
      type: String,
      enum: ['manual', 'migration', 'system'],
      default: 'manual',
    },
    notes: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

targetSchema.index({ storeId: 1, periodStart: 1, periodEnd: 1 }, { unique: true });
targetSchema.index({ storeId: 1, periodStart: -1, periodEnd: -1 });

module.exports = mongoose.model('Target', targetSchema);
