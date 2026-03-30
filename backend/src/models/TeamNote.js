const mongoose = require('mongoose');

const teamNoteSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  section: { type: String, default: 'general' },
  text: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

teamNoteSchema.index({ storeId: 1, section: 1, createdAt: -1 });

module.exports = mongoose.model('TeamNote', teamNoteSchema);
