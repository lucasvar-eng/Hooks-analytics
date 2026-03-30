const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },

    // TiendaNube
    tnAccessToken: { type: String },
    tnStoreId: { type: String },
    tnNombre: { type: String },

    // Meta OAuth (Sprint 3)
    metaAccessToken: { type: String },
    metaAdAccountId: { type: String },
    metaPageId: { type: String },
    metaPixelId: { type: String },
    metaBusinessAccountId: { type: String },
    metaTokenExpiresAt: { type: Date },

    // Configuración financiera
    cotizacionDolar: { type: Number, default: 0 },
    tasaIBB: { type: Number, default: 0 },
    feePlataformaPct: { type: Number, default: 0 },

    // Comisiones de pago configurables
    comisionPagoConfig: [
      {
        medioPago: String,
        cuotas: Number,
        comisionBase: Number,
        comisionCuotas: Number,
      },
    ],

    // Costos de envío
    costosEnvio: [
      {
        zona: String,
        costoFijo: Number,
        porcentajeOrden: Number,
      },
    ],

    // Costos adicionales
    costosAdicionales: [
      {
        nombre: String,
        monto: Number,
        tipo: { type: String, enum: ['fijo', 'porcentaje'] },
      },
    ],

    // Home metrics config
    metricasHome: {
      type: [String],
      default: ['ordenesPositivas', 'revenue', 'trueRoas', 'profit', 'ncPct'],
    },

    // Objetivos y benchmarks
    objetivos: {
      fase: { type: String, default: 'crecimiento' },
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
    },

    // Ad verdict thresholds (per-store customizable)
    adVerdictThresholds: {
      escalar: {
        roasMin: { type: Number },
        minSpend: { type: Number },
        minPurchases: { type: Number },
      },
      mantener: {
        roasMin: { type: Number },
        minSpend: { type: Number },
      },
      revisar: {
        roasMin: { type: Number },
        cpaMaxPct: { type: Number },
      },
      pausar: {
        roasMax: { type: Number },
        minSpend: { type: Number },
        minDays: { type: Number },
      },
      testear: {
        maxSpend: { type: Number },
        maxPurchases: { type: Number },
      },
    },

    // Alert config
    alertConfig: {
      enabledTypes: [String],
      recipients: [String],
    },

    // AI context per store
    aiContext: {
      instructions: { type: String, default: '' },
      files: [{
        filename: { type: String },
        content: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      }],
    },

    // Integration status
    integrationStatus: {
      tiendanube: {
        connected: { type: Boolean, default: false },
        lastSync: Date,
      },
      metaAds: {
        connected: { type: Boolean, default: false },
        lastSync: Date,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Store', storeSchema);
