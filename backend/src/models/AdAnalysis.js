const mongoose = require('mongoose');

/**
 * Cache de análisis IA por anuncio. Lo poblamos llamando a Claude con el copy
 * (creativeBody + creativeTitle) y guardamos los tags clasificadores + la
 * razón. Así no re-analizamos cada vez que se abre la página.
 *
 * El campo `angle` es el más importante para agrupar (ver getAngleStats).
 */

const adAnalysisSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    metaId: { type: String, required: true }, // ad metaId

    // Tags clasificadores
    angle: {
      type: String,
      enum: [
        'producto-urgencia',
        'social-proof',
        'descuento-general',
        'educativo',
        'transformacion',
        'generico-marca',
        'otro',
      ],
      required: true,
    },
    angleLabel: { type: String, required: true }, // "Producto + urgencia" — la versión legible

    hook: { type: String }, // primer gancho identificado
    tone: { type: String }, // "directo / informativo", "aspiracional", etc.
    cta: { type: String }, // CTA implícito o explícito
    target: { type: String }, // a quién le habla
    valueProposition: { type: String }, // promesa principal

    rationale: { type: String }, // por qué funciona o no funciona

    // Hash del copy para detectar cambios y re-analizar
    copyHash: { type: String, required: true },

    // Tracking
    model: { type: String },
    tokensUsed: { type: Number, default: 0 },
    analyzedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

adAnalysisSchema.index({ storeId: 1, metaId: 1 }, { unique: true });
adAnalysisSchema.index({ storeId: 1, angle: 1 });

module.exports = mongoose.model('AdAnalysis', adAnalysisSchema);
