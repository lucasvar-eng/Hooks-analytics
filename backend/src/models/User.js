const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    nombre: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    role: {
      type: String,
      enum: ['admin', 'analyst', 'viewer'],
      default: 'viewer',
    },
    storeAccess: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },

    // AI configuration per user
    aiConfig: {
      provider: { type: String, enum: ['anthropic', 'openai'], default: 'anthropic' },
      apiKeyEncrypted: { type: String, select: false },
      apiKeyIV: { type: String, select: false },
      apiKeyAuthTag: { type: String, select: false },
      modelAnalysis: { type: String },
      modelChat: { type: String },
      // Global AI instructions (apply to all stores)
      globalInstructions: { type: String, default: '' },
      globalFiles: [{
        filename: { type: String },
        content: { type: String, select: false },
        uploadedAt: { type: Date, default: Date.now },
      }],
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  if (obj.aiConfig) {
    delete obj.aiConfig.apiKeyEncrypted;
    delete obj.aiConfig.apiKeyIV;
    delete obj.aiConfig.apiKeyAuthTag;
    // Strip file content from serialization (keep filenames)
    if (obj.aiConfig.globalFiles) {
      obj.aiConfig.globalFiles = obj.aiConfig.globalFiles.map((f) => ({
        filename: f.filename,
        uploadedAt: f.uploadedAt,
      }));
    }
  }
  return obj;
};

module.exports = mongoose.model('User', userSchema);