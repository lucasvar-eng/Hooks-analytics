const mongoose = require('mongoose');

/**
 * Snapshot histórico de un competidor. Cada vez que se ejecuta scrape o analyze,
 * se guarda una copia del estado anterior antes de pisarlo. Permite ver evolución
 * temporal y detectar cambios.
 */
const competitorSnapshotSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    competitorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Competitor', required: true, index: true },
    capturedAt: { type: Date, default: Date.now, index: true },

    // Snapshot de campos cualitativos del competidor
    nombre: { type: String },
    url: { type: String },
    positioning: { type: String },
    avatar: { type: String },
    awarenessLevel: { type: String },
    mainOffer: { type: String },
    angles: [{ type: String }],
    territories: [{ type: String }],
    objectionsDetected: [{ type: String }],
    notas: { type: String },
    analysisResult: { type: String },

    // Origen del snapshot
    source: { type: String, enum: ['analyze', 'scrape', 'update', 'manual'], default: 'manual' },
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

competitorSnapshotSchema.index({ competitorId: 1, capturedAt: -1 });

module.exports = mongoose.model('CompetitorSnapshot', competitorSnapshotSchema);
