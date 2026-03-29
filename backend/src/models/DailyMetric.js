const mongoose = require('mongoose');

const dailyMetricSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    date: { type: Date, required: true },

    // === VENTAS (de Orders) ===
    ordenes: { type: Number, default: 0 },
    ordenesPositivas: { type: Number, default: 0 },
    revenue: { type: Number, default: 0 },
    netRevenue: { type: Number, default: 0 },
    aov: { type: Number, default: 0 },
    aovNeto: { type: Number, default: 0 },
    devoluciones: { type: Number, default: 0 },

    // === COSTOS (de Orders) ===
    costoProductos: { type: Number, default: 0 },
    costoEnvio: { type: Number, default: 0 },
    comisionPago: { type: Number, default: 0 },
    comisionCuotas: { type: Number, default: 0 },
    impuestosIBB: { type: Number, default: 0 },
    feePlataforma: { type: Number, default: 0 },

    // === PROFIT ===
    profit: { type: Number, default: 0 },
    profitMargin: { type: Number, default: 0 },

    // === NC/RC (Sprint 2) ===
    ncOrdenes: { type: Number, default: 0 },
    ncRevenue: { type: Number, default: 0 },
    ncNetRevenue: { type: Number, default: 0 },
    rcOrdenes: { type: Number, default: 0 },
    rcRevenue: { type: Number, default: 0 },
    ncPct: { type: Number, default: 0 },

    // === META ADS (Sprint 3) ===
    adSpend: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    metaPurchases: { type: Number, default: 0 },
    metaPurchaseValue: { type: Number, default: 0 },

    // === DERIVADOS ===
    roas: { type: Number, default: 0 },
    trueRoas: { type: Number, default: 0 },
    cpa: { type: Number, default: 0 },
    trueCpa: { type: Number, default: 0 },
    ncCpa: { type: Number, default: 0 },
    ncRoas: { type: Number, default: 0 },
    ncTrueRoas: { type: Number, default: 0 },
    cpc: { type: Number, default: 0 },
    ctr: { type: Number, default: 0 },
    cpm: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 },

    // === CASHFLOW (Sprint 4) ===
    liquidable: { type: Number, default: 0 },
    pagosRecibidos: { type: Number, default: 0 },
    pagosPendientes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

dailyMetricSchema.index({ storeId: 1, date: 1 }, { unique: true });
dailyMetricSchema.index({ storeId: 1, date: -1 });

module.exports = mongoose.model('DailyMetric', dailyMetricSchema);
