const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['manager', 'employee'], default: 'employee' },
    department: { type: String, trim: true, maxlength: 80, default: '' },
    position: { type: String, trim: true, maxlength: 80, default: '' },
    active: { type: Boolean, default: true },
    failedLogins: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    // Chave pública de assinatura (a privada nunca sai do navegador do signatário)
    publicKey: {
      jwk: { type: Object },
      fingerprint: { type: String },
      registeredAt: { type: Date },
    },
  },
  { timestamps: true }
);

userSchema.methods.toSafe = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    department: this.department,
    position: this.position,
    active: this.active,
    hasPublicKey: !!(this.publicKey && this.publicKey.fingerprint),
    publicKeyFingerprint: this.publicKey ? this.publicKey.fingerprint : undefined,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
