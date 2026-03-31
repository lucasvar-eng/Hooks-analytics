const mongoose = require('mongoose');

const aiConversationSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    section: { type: String, default: 'dashboard', required: true },
    messages: [
      {
        role: { type: String, enum: ['user', 'assistant'], required: true },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

aiConversationSchema.index({ storeId: 1, userId: 1, section: 1 }, { unique: true });

module.exports = mongoose.model('AIConversation', aiConversationSchema);
