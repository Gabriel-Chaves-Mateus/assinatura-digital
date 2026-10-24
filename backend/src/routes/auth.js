const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const User = require('../models/User');
const { validate } = require('../middleware/validate');
const { authenticate, signAccess, signStepUp } = require('../middleware/auth');
const { normalizePublicJwk, jwkFingerprint } = require('../utils/signing');

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
// hash fictício para igualar o tempo de resposta quando o usuário não existe
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(200),
});

router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash +failedLogins +lockUntil');
  const generic = { error: 'E-mail ou senha incorretos' };

  if (!user || !user.active) {
    await bcrypt.compare(password, DUMMY_HASH);
    return res.status(401).json(generic);
  }
  if (user.lockUntil && user.lockUntil > new Date()) {
    return res.status(429).json({ error: 'Conta temporariamente bloqueada. Tente novamente mais tarde.' });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    user.failedLogins += 1;
    if (user.failedLogins >= MAX_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_MS);
      user.failedLogins = 0;
    }
    await user.save();
    return res.status(401).json(generic);
  }
  user.failedLogins = 0;
  user.lockUntil = undefined;
  await user.save();
  res.json({ token: signAccess(user), user: user.toSafe() });
});

router.get('/me', authenticate, (req, res) => res.json({ user: req.user.toSafe() }));

// Reautenticação (step-up) exigida antes de cada assinatura digital
router.post('/confirm', authenticate, validate(z.object({ password: z.string().min(1).max(200) })), async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(req.body.password, user.passwordHash))) {
    return res.status(401).json({ error: 'Senha incorreta' });
  }
  res.json({ signToken: signStepUp(user) });
});

// Registro da chave PÚBLICA do signatário (a privada fica apenas no navegador)
router.put('/public-key', authenticate, validate(z.object({ jwk: z.record(z.any()) })), async (req, res) => {
  let jwk;
  try {
    jwk = normalizePublicJwk(req.body.jwk);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  req.user.publicKey = { jwk, fingerprint: jwkFingerprint(jwk), registeredAt: new Date() };
  await req.user.save();
  res.json({ user: req.user.toSafe() });
});

// Chave pública (JWK) do próprio usuário — usada para conferir se a chave local corresponde
router.get('/public-key', authenticate, (req, res) => {
  const pk = req.user.publicKey;
  res.json({ jwk: pk && pk.jwk ? pk.jwk : null, fingerprint: pk ? pk.fingerprint : null });
});

module.exports = router;
