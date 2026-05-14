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

    // Notificaciones: a dónde mandar alertas / digests.
    // Si vacío, se usa `email` como fallback.
    notificationEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: '',
    },
    // API key personal de Resend (encrypted). Cada user trae la suya;
    // la app le manda los emails a sí mismo con su propia key.
    // Por el restricción de Resend free (solo a la cuenta del owner),
    // sin dominio verificado el user solo recibe SUS propios mails.
    resendApiKeyEncrypted: { type: String, select: false },
    resendApiKeyIV: { type: String, select: false },
    resendApiKeyAuthTag: { type: String, select: false },
    resendFromEmail: { type: String, default: '' },
    notificationPreferences: {
      alerts: {
        enabled: { type: Boolean, default: true },
        channels: { type: [String], enum: ['email'], default: ['email'] },
        minSeverity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },
      },
      digests: {
        daily: { type: Boolean, default: false },
        weekly: { type: Boolean, default: true },
      },
      reports: {
        onPublish: { type: Boolean, default: true },
      },
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
  delete obj.resendApiKeyEncrypted;
  delete obj.resendApiKeyIV;
  delete obj.resendApiKeyAuthTag;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
