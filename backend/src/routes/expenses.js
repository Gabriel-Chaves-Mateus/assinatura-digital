const router = require('express').Router();
const multer = require('multer');
const { z } = require('zod');
const Expense = require('../models/Expense');
const Signature = require('../models/Signature');
const User = require('../models/User');
const { validate, validId } = require('../middleware/validate');
const { authenticate, requireRole, requireSignToken } = require('../middleware/auth');
const { buildPayload, sha256Hex, verifySignature, jwkFingerprint } = require('../utils/signing');
const mailer = require('../utils/mailer');
const config = require('../config');

router.use(authenticate);

const MAX_FILE = 2 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE, files: 5, fields: 5 },
});

// Tipo real do arquivo pelos "magic bytes" (não confiamos no mimetype do cliente)
function sniffMime(buf) {
  if (buf.length > 4 && buf.slice(0, 4).toString() === '%PDF') return 'application/pdf';
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  return null;
}
const EXT = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };

const itemSchema = z.object({
  description: z.string().trim().min(2).max(200),
  amount: z.number().positive().max(1_000_000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (AAAA-MM-DD)'),
});
const expenseSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(2000).default(''),
  items: z.array(itemSchema).min(1).max(50),
});

const round2 = (n) => Math.round(n * 100) / 100;
const populate = [
  { path: 'employee', select: 'name email department position' },
  { path: 'validatedBy', select: 'name email' },
];

function summary(e) {
  return {
    id: e._id.toString(),
    title: e.title,
    description: e.description,
    items: e.items,
    total: e.total,
    status: e.status,
    employee: e.employee && e.employee.name ? { id: e.employee._id, name: e.employee.name, email: e.employee.email, department: e.employee.department } : e.employee,
    validatedBy: e.validatedBy && e.validatedBy.name ? { id: e.validatedBy._id, name: e.validatedBy.name } : null,
    validatedAt: e.validatedAt,
    validationNote: e.validationNote,
    receipts: e.receipts.map((r, i) => ({ index: i, filename: r.filename, mime: r.mime, size: r.size, sha256: r.sha256 })),
    signature: e.signature ? e.signature.toString() : null,
    createdAt: e.createdAt,
  };
}

const canView = (user, e) => user.role === 'manager' || e.employee._id.equals(user._id);

// ---------- Criar relatório de despesas (com upload de recibos) ----------
router.post('/', upload.array('receipts', 5), async (req, res) => {
  let data;
  try {
    data = expenseSchema.parse(JSON.parse(req.body.data || '{}'));
  } catch (e) {
    return res.status(400).json({ error: 'Dados inválidos', details: e.issues || undefined });
  }
  const receipts = [];
  for (const f of req.files || []) {
    const mime = sniffMime(f.buffer);
    if (!mime) return res.status(400).json({ error: `Arquivo "${f.originalname}" não é PDF, PNG ou JPEG` });
    receipts.push({
      filename: `recibo-${receipts.length + 1}.${EXT[mime]}`, // nome gerado: evita path traversal/XSS por nome
      mime,
      size: f.size,
      sha256: sha256Hex(f.buffer),
      data: f.buffer,
    });
  }
  if (!receipts.length) return res.status(400).json({ error: 'Anexe ao menos um recibo' });

  const total = round2(data.items.reduce((s, i) => s + i.amount, 0));
  const expense = await Expense.create({ ...data, total, receipts, employee: req.user._id });

  // Notificação por e-mail aos gerentes (não bloqueia a resposta)
  User.find({ role: 'manager', active: true })
    .then((managers) => mailer.notifyNewExpense(managers, expense, req.user))
    .catch(() => {});

  res.status(201).json({ id: expense._id.toString() });
});

// ---------- Listar ----------
router.get('/', async (req, res) => {
  const q = {};
  const status = req.query.status;
  if (typeof status === 'string' && ['pending', 'approved', 'rejected', 'signed'].includes(status)) q.status = status;
  if (req.user.role !== 'manager' || req.query.mine === 'true') q.employee = req.user._id;
  const list = await Expense.find(q).sort({ createdAt: -1 }).limit(200).populate(populate);
  res.json({ expenses: list.map(summary) });
});

router.get('/:id', validId(), async (req, res) => {
  const e = await Expense.findById(req.params.id).populate(populate);
  if (!e || !canView(req.user, e)) return res.status(404).json({ error: 'Despesa não encontrada' });
  res.json({ expense: summary(e) });
});

// ---------- Download do recibo ----------
router.get('/:id/receipts/:index', validId(), async (req, res) => {
  const e = await Expense.findById(req.params.id).select('+receipts.data').populate('employee', '_id');
  const idx = Number.parseInt(req.params.index, 10);
  if (!e || !canView(req.user, e) || !e.receipts[idx]) return res.status(404).json({ error: 'Recibo não encontrado' });
  const r = e.receipts[idx];
  res.set({
    'Content-Type': r.mime,
    'Content-Disposition': `inline; filename="${r.filename}"`,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  res.send(r.data);
});

// ---------- Validação pelo gerente ----------
router.patch(
  '/:id/validate',
  validId(),
  requireRole('manager'),
  validate(z.object({ decision: z.enum(['approved', 'rejected']), note: z.string().trim().max(1000).default('') })),
  async (req, res) => {
    const e = await Expense.findById(req.params.id).populate('employee', 'name email');
    if (!e) return res.status(404).json({ error: 'Despesa não encontrada' });
    if (e.employee._id.equals(req.user._id)) return res.status(403).json({ error: 'Segregação de funções: você não pode validar sua própria despesa' });
    if (e.status !== 'pending') return res.status(409).json({ error: 'Despesa não está pendente' });
    e.status = req.body.decision;
    e.validatedBy = req.user._id;
    e.validatedAt = new Date();
    e.validationNote = req.body.note;
    await e.save();
    mailer.notifyDecision(e.employee, e, req.body.decision, req.body.note).catch(() => {});
    res.json({ ok: true, status: e.status });
  }
);

// ---------- Assinatura digital ----------
// 1) O servidor monta o documento canônico a partir do estado atual da despesa.
router.get('/:id/signing-payload', validId(), requireRole('manager'), async (req, res) => {
  const e = await Expense.findById(req.params.id);
  if (!e) return res.status(404).json({ error: 'Despesa não encontrada' });
  if (e.status !== 'approved') return res.status(409).json({ error: 'Somente despesas aprovadas podem ser assinadas' });
  const payload = buildPayload(e, req.user._id, new Date().toISOString());
  res.json({ payload, documentHash: sha256Hex(payload) });
});

// 2) O navegador assina o payload com a chave privada (Web Crypto) e envia só a assinatura.
router.post(
  '/:id/sign',
  validId(),
  requireRole('manager'),
  requireSignToken,
  validate(z.object({ payload: z.string().max(100_000), signature: z.string().max(400) })),
  async (req, res) => {
    const { payload, signature } = req.body;
    const e = await Expense.findById(req.params.id);
    if (!e) return res.status(404).json({ error: 'Despesa não encontrada' });
    if (e.employee.equals(req.user._id)) return res.status(403).json({ error: 'Segregação de funções' });
    if (e.status !== 'approved') return res.status(409).json({ error: 'Somente despesas aprovadas podem ser assinadas' });

    const pk = req.user.publicKey;
    if (!pk || !pk.jwk) return res.status(400).json({ error: 'Registre sua chave pública antes de assinar' });

    // O payload deve corresponder EXATAMENTE ao estado atual da despesa e ao signatário autenticado
    let issuedAt;
    try {
      issuedAt = JSON.parse(payload).issuedAt;
    } catch {
      return res.status(400).json({ error: 'Payload inválido' });
    }
    if (typeof issuedAt !== 'string' || Math.abs(Date.now() - Date.parse(issuedAt)) > config.payloadMaxSkewMs) {
      return res.status(400).json({ error: 'Payload expirado. Reinicie a assinatura.' });
    }
    if (buildPayload(e, req.user._id, issuedAt) !== payload) {
      return res.status(409).json({ error: 'O documento mudou ou o payload foi adulterado' });
    }
    if (!verifySignature(payload, signature, pk.jwk)) {
      return res.status(400).json({ error: 'Assinatura inválida para a chave pública registrada' });
    }

    // Transição atômica approved -> signed (evita dupla assinatura em corrida)
    const locked = await Expense.updateOne({ _id: e._id, status: 'approved' }, { status: 'signed' });
    if (locked.modifiedCount !== 1) return res.status(409).json({ error: 'Despesa já assinada' });
    try {
      const sig = await Signature.create({
        expense: e._id,
        signer: req.user._id,
        payload,
        documentHash: sha256Hex(payload),
        signature,
        publicKeyJwk: pk.jwk,
        publicKeyFingerprint: pk.fingerprint || jwkFingerprint(pk.jwk),
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
      });
      await Expense.updateOne({ _id: e._id }, { signature: sig._id });
      User.findById(e.employee).then((emp) => emp && mailer.notifySigned(emp, e, sig)).catch(() => {});
      res.status(201).json({ signatureId: sig._id.toString(), documentHash: sig.documentHash, signedAt: sig.signedAt });
    } catch (err) {
      await Expense.updateOne({ _id: e._id }, { status: 'approved' });
      throw err;
    }
  }
);

module.exports = router;
