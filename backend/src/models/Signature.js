const mongoose = require('mongoose');

const signatureSchema = new mongoose.Schema(
  {
    expense: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', required: true, unique: true },
    signer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    algorithm: { type: String, default: 'ECDSA-P256-SHA256' },
    payload: { type: String, required: true }, // JSON canônico assinado
    documentHash: { type: String, required: true }, // SHA-256 (hex) do payload
    signature: { type: String, required: true }, // base64 (r||s, IEEE P1363)
    publicKeyJwk: { type: Object, required: true }, // snapshot da chave usada
    publicKeyFingerprint: { type: String, required: true },
    signedAt: { type: Date, default: Date.now }, // carimbo de tempo do servidor
    ip: String,
    userAgent: String,
  },
  { timestamps: true }
);

// Assinaturas são imutáveis: bloqueia atualizações (não repúdio / trilha de auditoria)
['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'].forEach((op) => {
  signatureSchema.pre(op, function () {
    throw new Error('Assinaturas são imutáveis');
  });
});

module.exports = mongoose.model('Signature', signatureSchema);
