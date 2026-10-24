const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const User = require('../models/User');
const { validate, validId } = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('manager'));

const password = z
  .string()
  .min(10, 'Mínimo de 10 caracteres')
  .max(128)
  .regex(/[a-z]/, 'Inclua letra minúscula')
  .regex(/[A-Z]/, 'Inclua letra maiúscula')
  .regex(/[0-9]/, 'Inclua número');

const base = {
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  role: z.enum(['manager', 'employee']).default('employee'),
  department: z.string().trim().max(80).default(''),
  position: z.string().trim().max(80).default(''),
};
const createSchema = z.object({ ...base, password });
const updateSchema = z.object({ ...base, password: password.optional(), active: z.boolean().optional() });

router.get('/', async (req, res) => {
  const users = await User.find().sort({ name: 1 });
  res.json({ employees: users.map((u) => u.toSafe()) });
});

router.post('/', validate(createSchema), async (req, res) => {
  const { password: pw, email, ...rest } = req.body;
  if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ error: 'E-mail já cadastrado' });
  const user = await User.create({ ...rest, email, passwordHash: await bcrypt.hash(pw, 12) });
  res.status(201).json({ employee: user.toSafe() });
});

router.put('/:id', validId(), validate(updateSchema), async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Funcionário não encontrado' });
  const { password: pw, email, active, ...rest } = req.body;
  if (email.toLowerCase() !== user.email && (await User.exists({ email: email.toLowerCase() }))) {
    return res.status(409).json({ error: 'E-mail já cadastrado' });
  }
  if (user._id.equals(req.user._id) && (active === false || rest.role !== 'manager')) {
    return res.status(400).json({ error: 'Você não pode remover seu próprio acesso de gerente' });
  }
  Object.assign(user, rest, { email });
  if (typeof active === 'boolean') user.active = active;
  if (pw) user.passwordHash = await bcrypt.hash(pw, 12);
  await user.save();
  res.json({ employee: user.toSafe() });
});

// "Exclusão" lógica: preserva histórico e assinaturas (não repúdio)
router.delete('/:id', validId(), async (req, res) => {
  if (req.params.id === req.user._id.toString()) return res.status(400).json({ error: 'Não é possível desativar a si mesmo' });
  const user = await User.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  if (!user) return res.status(404).json({ error: 'Funcionário não encontrado' });
  res.json({ employee: user.toSafe() });
});

module.exports = router;
