// Teste ponta a ponta da API com MongoDB em memória (pulado se o binário não puder ser baixado).
const test = require('node:test');
const assert = require('node:assert');
const { webcrypto } = require('node:crypto');

process.env.JWT_SECRET = 'x'.repeat(48);
process.env.MONGO_URI = 'mongodb://unused';

const subtle = webcrypto.subtle;
let mongod, server, base, mongoose, skip = false;
const state = {};

async function http(method, path, { token, body, headers = {}, form } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(base + '/api' + path, { method, headers: h, body: payload });
  let data = null;
  try { data = await res.clone().json(); } catch {}
  return { status: res.status, data, res };
}

test.before(async () => {
  try {
    if (process.env.TEST_MONGO_URI) {
      mongoose = require('mongoose');
      await mongoose.connect(process.env.TEST_MONGO_URI);
      await mongoose.connection.dropDatabase();
      await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
    } else {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    }
  } catch (e) {
    skip = 'MongoDB em memória indisponível: ' + e.message.slice(0, 80);
    return;
  }
  mongoose = require('mongoose');
  if (mongod) await mongoose.connect(mongod.getUri());
  const bcrypt = require('bcryptjs');
  const User = require('../src/models/User');
  await User.create([
    { name: 'Gerente A', email: 'a@x.com', role: 'manager', passwordHash: await bcrypt.hash('Senha12345', 4) },
    { name: 'Funcionario', email: 'f@x.com', role: 'employee', passwordHash: await bcrypt.hash('Senha12345', 4) },
  ]);
  server = require('../src/app').listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  if (server) server.close();
  if (mongoose) await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test('fluxo completo: despesa -> validação -> assinatura -> verificação -> adulteração', async (t) => {
  if (skip) return t.skip(skip);

  // login
  const mgr = await http('POST', '/auth/login', { body: { email: 'a@x.com', password: 'Senha12345' } });
  assert.strictEqual(mgr.status, 200);
  const emp = await http('POST', '/auth/login', { body: { email: 'f@x.com', password: 'Senha12345' } });
  state.mt = mgr.data.token; state.et = emp.data.token;
  assert.strictEqual((await http('POST', '/auth/login', { body: { email: 'a@x.com', password: 'errada' } })).status, 401);

  // NoSQL injection no login é bloqueada
  const inj = await http('POST', '/auth/login', { body: { email: { $ne: '' }, password: { $ne: '' } } });
  assert.strictEqual(inj.status, 400);

  // funcionário não acessa área de gerente
  assert.strictEqual((await http('GET', '/employees', { token: state.et })).status, 403);
  assert.strictEqual((await http('GET', '/signatures', { token: state.et })).status, 403);

  // envio de despesa com recibo (e rejeição de arquivo falso)
  const bad = new FormData();
  bad.append('data', JSON.stringify({ title: 'Teste', items: [{ description: 'Taxi', amount: 10, date: '2026-01-01' }] }));
  bad.append('receipts', new Blob([Buffer.from('<script>alert(1)</script>')], { type: 'image/png' }), 'x.png');
  assert.strictEqual((await http('POST', '/expenses', { token: state.et, form: bad })).status, 400);

  const fd = new FormData();
  fd.append('data', JSON.stringify({ title: 'Viagem SP', description: 'ok', items: [{ description: 'Táxi', amount: 50.25, date: '2026-01-02' }, { description: 'Hotel', amount: 300, date: '2026-01-02' }] }));
  fd.append('receipts', new Blob([png], { type: 'image/png' }), 'r.png');
  const created = await http('POST', '/expenses', { token: state.et, form: fd });
  assert.strictEqual(created.status, 201);
  const id = created.data.id;
  const detail = await http('GET', `/expenses/${id}`, { token: state.et });
  assert.strictEqual(detail.data.expense.total, 350.25);

  // não pode assinar antes de aprovar
  assert.strictEqual((await http('GET', `/expenses/${id}/signing-payload`, { token: state.mt })).status, 409);

  // validação
  assert.strictEqual((await http('PATCH', `/expenses/${id}/validate`, { token: state.et, body: { decision: 'approved' } })).status, 403);
  assert.strictEqual((await http('PATCH', `/expenses/${id}/validate`, { token: state.mt, body: { decision: 'approved', note: 'ok' } })).status, 200);

  // chave de assinatura gerada "no navegador"
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', kp.publicKey);

  // sem chave registrada: falha
  const confirm = await http('POST', '/auth/confirm', { token: state.mt, body: { password: 'Senha12345' } });
  assert.strictEqual(confirm.status, 200);
  const signToken = confirm.data.signToken;
  const pl = await http('GET', `/expenses/${id}/signing-payload`, { token: state.mt });
  const sign = async (payload) => Buffer.from(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, new TextEncoder().encode(payload))).toString('base64');
  let r = await http('POST', `/expenses/${id}/sign`, { token: state.mt, headers: { 'X-Sign-Token': signToken }, body: { payload: pl.data.payload, signature: await sign(pl.data.payload) } });
  assert.strictEqual(r.status, 400);

  assert.strictEqual((await http('PUT', '/auth/public-key', { token: state.mt, body: { jwk } })).status, 200);

  // sem token de reautenticação: falha
  r = await http('POST', `/expenses/${id}/sign`, { token: state.mt, body: { payload: pl.data.payload, signature: await sign(pl.data.payload) } });
  assert.strictEqual(r.status, 401);

  // payload adulterado: falha
  const forged = pl.data.payload.replace('350.25', '3500.25');
  r = await http('POST', `/expenses/${id}/sign`, { token: state.mt, headers: { 'X-Sign-Token': signToken }, body: { payload: forged, signature: await sign(forged) } });
  assert.strictEqual(r.status, 409);

  // assinatura correta
  r = await http('POST', `/expenses/${id}/sign`, { token: state.mt, headers: { 'X-Sign-Token': signToken }, body: { payload: pl.data.payload, signature: await sign(pl.data.payload) } });
  assert.strictEqual(r.status, 201, JSON.stringify(r.data));
  const sigId = r.data.signatureId;

  // segunda assinatura: bloqueada
  r = await http('POST', `/expenses/${id}/sign`, { token: state.mt, headers: { 'X-Sign-Token': signToken }, body: { payload: pl.data.payload, signature: await sign(pl.data.payload) } });
  assert.strictEqual(r.status, 409);

  // verificação: tudo válido
  let v = await http('GET', `/signatures/${sigId}/verify`, { token: state.mt });
  assert.strictEqual(v.data.valid, true, JSON.stringify(v.data.checks));

  // adulteração direta no banco => integridade falha
  const Expense = require('../src/models/Expense');
  await Expense.updateOne({ _id: id }, { total: 1 });
  v = await http('GET', `/signatures/${sigId}/verify`, { token: state.mt });
  assert.strictEqual(v.data.valid, false);
  assert.strictEqual(v.data.checks.documentUnchanged, false);
  assert.strictEqual(v.data.checks.signatureValid, true); // a assinatura em si continua íntegra

  // assinaturas são imutáveis
  const Signature = require('../src/models/Signature');
  await assert.rejects(() => Signature.updateOne({ _id: sigId }, { signature: 'x' }));
});
