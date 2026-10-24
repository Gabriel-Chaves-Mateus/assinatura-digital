const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

/** Autentica via Bearer JWT (algoritmo fixado em HS256 para evitar "alg confusion"). */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Não autenticado' });
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], audience: 'access' });
    const user = await User.findById(payload.sub);
    if (!user || !user.active) return res.status(401).json({ error: 'Usuário inválido' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Acesso negado' });

/** Exige token curto de reautenticação (obtido com a senha) para assinar. */
function requireSignToken(req, res, next) {
  try {
    const token = req.headers['x-sign-token'];
    if (!token) return res.status(401).json({ error: 'Confirmação de senha necessária' });
    const p = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], audience: 'sign' });
    if (p.sub !== req.user._id.toString()) return res.status(401).json({ error: 'Token de assinatura inválido' });
    next();
  } catch {
    res.status(401).json({ error: 'Confirmação de senha expirada' });
  }
}

const signAccess = (user) =>
  jwt.sign({ role: user.role }, config.jwtSecret, {
    algorithm: 'HS256',
    subject: user._id.toString(),
    audience: 'access',
    expiresIn: config.jwtExpires,
  });

const signStepUp = (user) =>
  jwt.sign({}, config.jwtSecret, {
    algorithm: 'HS256',
    subject: user._id.toString(),
    audience: 'sign',
    expiresIn: config.signTokenTtlSeconds,
  });

module.exports = { authenticate, requireRole, requireSignToken, signAccess, signStepUp };
