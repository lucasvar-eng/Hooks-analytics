const mongoose = require('mongoose');

const languageBankSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    tipo: { type: String, enum: ['frase', 'objecion', 'vocabulario', 'hook'], required: true },
    texto: { type: String, required: true },
    response: { type: String },
    tags: [{ type: String }],
    sentiment: { type: String, enum: ['positivo', 'neutro', 'negativo'], default: 'neutro' },
  },
  { timestamps: true }
);

languageBankSchema.index({ storeId: 1, tipo: 1 });

module.exports = mongoose.model('LanguageBank', languageBankSchema);
