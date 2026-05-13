const mongoose = require('mongoose');

const insightSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  section: { type: String, required: true }, // dashboard, meta, costos, productos, clientes, creativos, cashflow
  tipo: { type: String, enum: ['alert', 'win', 'diagnostic', 'action_item', 'verdict', 'note'], required: true },
  severidad: { type: String, enum: ['critical', 'warning', 'positive', 'neutral', 'diagnostic', 'verdict'], default: 'neutral' },
  titulo: { type: String, required: true },
  descripcion: { type: String },
  impacto: { type: String }, // e.g. "~$376M/mes en revenue potencial"
  verdict: { type: String, enum: ['ESCALAR', 'PAUSAR', 'TESTEAR', 'REVISAR', 'IMPLEMENTAR', 'MANTENER', null], default: null },
  layer: { type: String, enum: ['L1', 'L2', 'L3'], default: 'L1' }, // L1=auto rule, L2=AI, L3=manual
  generatedBy: { type: String, enum: ['rule_engine', 'claude', 'openai', 'manual', 'local'], default: 'rule_engine' },
  metricKey: { type: String }, // optional: which metric this relates to
  metadata: { type: mongoose.Schema.Types.Mixed }, // flexible extra data
  confidence: { type: Number, default: 0.5 },
  pinned: { type: Boolean, default: false }, // if pinned as top insight
  estado: { type: String, enum: ['active', 'dismissed', 'resolved'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

insightSchema.index({ storeId: 1, section: 1, estado: 1, createdAt: -1 });
insightSchema.index({ storeId: 1, pinned: 1 });

module.exports = mongoose.model('Insight', insightSchema);
