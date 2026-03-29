const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  tipo: {
    type: String,
    enum: ['performance', 'anomaly', 'threshold', 'system'],
    required: true,
  },
  titulo: { type: String, required: true },
  descripcion: { type: String, default: '' },
  metricas: { type: mongoose.Schema.Types.Mixed },
  severidad: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'warning',
  },
  fechaDetectada: { type: Date, default: Date.now },
  estado: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved'],
    default: 'active',
  },
  resolvedAt: { type: Date },
  actions: [
    {
      label: { type: String },
      type: { type: String },
      payload: { type: mongoose.Schema.Types.Mixed },
    },
  ],
});

alertSchema.index({ storeId: 1, estado: 1, fechaDetectada: -1 });
alertSchema.index({ storeId: 1, tipo: 1, fechaDetectada: -1 });

module.exports = mongoose.model('Alert', alertSchema);
