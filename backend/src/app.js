const express = require('express');
require('express-async-errors'); // Express 4: encaminha rejeições de handlers async ao tratador de erros
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const config = require('./config');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // atrás de proxy/TLS (Render, nginx...) para IP correto

// Cabeçalhos HTTP de segurança (CSP, HSTS, noSniff, frameguard, etc.)
app.use(
  helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    hsts: { maxAge: 15552000, includeSubDomains: true },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Origem não permitida'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Sign-Token'],
    maxAge: 600,
  })
);

app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

app.use(express.json({ limit: '100kb' }));
// Remove operadores NoSQL ($, .) de body/query/params => proteção contra NoSQL injection
app.use(mongoSanitize());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/signatures', require('./routes/signatures'));

app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

// Tratador de erros: nunca vaza stack trace ao cliente
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Arquivo excede 2 MB' });
  if (err.name === 'MulterError') return res.status(400).json({ error: 'Upload inválido' });
  if (err.message === 'Origem não permitida') return res.status(403).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Erro interno' });
});

module.exports = app;
