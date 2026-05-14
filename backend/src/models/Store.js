const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    plataforma: {
      type: String,
      enum: ['manual', 'tiendanube', 'shopify'],
      default: 'manual',
    },
    logoUrl: { type: String },
    storeUrl: { type: String },

    // TiendaNube
    // ⚠ tnAccessToken legacy — deprecated, se migra a tnToken* encriptado.
    // Mantener select:false para que no salga en lecturas normales.
    tnAccessToken: { type: String, select: false },
    tnTokenEncrypted: { type: String, select: false },
    tnTokenIV: { type: String, select: false },
    tnTokenAuthTag: { type: String, select: false },
    tnStoreId: { type: String },
    tnNombre: { type: String },
    tnTokenSource: { type: String, enum: ['manual', 'cro_service'], default: 'manual' },

    // Meta OAuth
    metaAccessToken: { type: String, select: false }, // ⚠ legacy
    metaTokenEncrypted: { type: String, select: false },
    metaTokenIV: { type: String, select: false },
    metaTokenAuthTag: { type: String, select: false },
    metaAdAccountId: { type: String },
    metaAdAccounts: [
      {
        id: { type: String },
        accountId: { type: String },
        name: { type: String },
        status: { type: Number },
        currency: { type: String },
        isPrimary: { type: Boolean, default: false },
        connectedAt: { type: Date, default: Date.now },
      },
    ],
    metaPageId: { type: String },
    metaPixelId: { type: String },
    metaBusinessAccountId: { type: String },
    metaTokenExpiresAt: { type: Date },

    // Shopify
    shopifyAccessToken: { type: String, select: false }, // ⚠ legacy
    shopifyTokenEncrypted: { type: String, select: false },
    shopifyTokenIV: { type: String, select: false },
    shopifyTokenAuthTag: { type: String, select: false },
    shopifyShopDomain: { type: String },
    shopifyShopName: { type: String },
    shopifyShopId: { type: String },

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
      default: ['ordenesPositivas', 'revenue', 'trueRoas', 'profit', 'conversionRate'],
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

    // Google Sheets
    googleSheets: {
      spreadsheetId: { type: String, default: '' },
      creativeMasterEnabled: { type: Boolean, default: false },
      lastSync: { type: Date, default: null },
      lastError: { type: String, default: '' },
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
      shopify: {
        connected: { type: Boolean, default: false },
        lastSync: Date,
      },
    },
  },
  { timestamps: true }
);

// Defensa en profundidad: aunque los campos son select:false, si por error alguien
// los hace .select('+...'), toJSON tira los tokens de la response.
const TOKEN_FIELDS = [
  'tnAccessToken', 'tnTokenEncrypted', 'tnTokenIV', 'tnTokenAuthTag',
  'metaAccessToken', 'metaTokenEncrypted', 'metaTokenIV', 'metaTokenAuthTag',
  'shopifyAccessToken', 'shopifyTokenEncrypted', 'shopifyTokenIV', 'shopifyTokenAuthTag',
];
storeSchema.methods.toJSON = function () {
  const obj = this.toObject();
  for (const field of TOKEN_FIELDS) delete obj[field];
  return obj;
};

storeSchema.index({ tnStoreId: 1 }, { unique: true, sparse: true });
storeSchema.index({ shopifyShopDomain: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Store', storeSchema);
