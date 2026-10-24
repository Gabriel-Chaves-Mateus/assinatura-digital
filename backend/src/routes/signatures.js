const router = require('express').Router();
const Signature = require('../models/Signature');
const Expense = require('../models/Expense');
const { validId } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { buildPayload, sha256Hex, verifySignature, jwkFingerprint } = require('../utils/signing');

router.use(authenticate, requireRole('manager'));

router.get('/', async (req, res) => {
  const sigs = await Signature.find()
    .sort({ signedAt: -1 })
    .limit(200)
    .populate('signer', 'name email')
    .populate({ path: 'expense', select: 'title total employee', populate: { path: 'employee', select: 'name' } });
  res.json({
    signatures: sigs.map((s) => ({
      id: s._id.toString(),
      expenseId: s.expense && s.expense._id,
      title: s.expense && s.expense.title,
      total: s.expense && s.expense.total,
      employee: s.expense && s.expense.employee && s.expense.employee.name,
      signer: s.signer && s.signer.name,
      signedAt: s.signedAt,
      documentHash: s.documentHash,
      algorithm: s.algorithm,
    })),
  });
});

/**
 * Verificação completa — responde às 3 garantias exigidas:
 *  - autenticidade: a assinatura confere com a chave pública do signatário
 *  - integridade:   o documento atual é idêntico ao que foi assinado (inclui hash dos recibos)
 *  - não repúdio:   a chave pública está vinculada ao signatário e registrada com data/IP
 */
router.get('/:id/verify', validId(), async (req, res) => {
  const sig = await Signature.findById(req.params.id).populate('signer', 'name email');
  if (!sig) return res.status(404).json({ error: 'Assinatura não encontrada' });
  const expense = await Expense.findById(sig.expense).select('+receipts.data');
  if (!expense) return res.status(404).json({ error: 'Despesa não encontrada' });

  let issuedAt = null;
  try {
    issuedAt = JSON.parse(sig.payload).issuedAt;
  } catch {}

  const rebuilt = buildPayload(expense, sig.signer._id, issuedAt);
  const receiptsOk = expense.receipts.every((r) => sha256Hex(r.data) === r.sha256);

  const checks = {
    signatureValid: verifySignature(sig.payload, sig.signature, sig.publicKeyJwk), // autenticidade
    hashMatches: sha256Hex(sig.payload) === sig.documentHash,
    documentUnchanged: rebuilt === sig.payload, // integridade dos dados
    receiptsUnchanged: receiptsOk, // integridade dos arquivos
    keyFingerprintMatches: jwkFingerprint(sig.publicKeyJwk) === sig.publicKeyFingerprint, // vínculo da chave
  };
  res.json({
    valid: Object.values(checks).every(Boolean),
    checks,
    signature: {
      id: sig._id.toString(),
      signer: sig.signer && { id: sig.signer._id, name: sig.signer.name, email: sig.signer.email },
      signedAt: sig.signedAt,
      algorithm: sig.algorithm,
      documentHash: sig.documentHash,
      publicKeyFingerprint: sig.publicKeyFingerprint,
      publicKeyJwk: sig.publicKeyJwk,
      payload: sig.payload,
      signature: sig.signature,
      ip: sig.ip,
    },
  });
});

module.exports = router;
