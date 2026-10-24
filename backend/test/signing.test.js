// Testa o ciclo completo de assinatura: WebCrypto (como no navegador) -> verificação no servidor (Node crypto)
const test = require('node:test');
const assert = require('node:assert');
const { webcrypto } = require('node:crypto');
const { canonicalize, sha256Hex, buildPayload, jwkFingerprint, normalizePublicJwk, verifySignature } = require('../src/utils/signing');

const subtle = webcrypto.subtle;
const b64 = (buf) => Buffer.from(buf).toString('base64');

const fakeExpense = () => ({
  _id: 'exp1',
  employee: 'emp1',
  title: 'Viagem',
  description: '',
  items: [{ description: 'Táxi', amount: 50.5, date: '2026-01-02' }],
  total: 50.5,
  receipts: [{ filename: 'recibo-1.pdf', sha256: 'abc', size: 10 }],
  validatedBy: 'mgr1',
  validatedAt: new Date('2026-01-03T10:00:00Z'),
});

async function newKeys() {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', kp.publicKey);
  return { kp, jwk };
}
const sign = async (priv, payload) =>
  b64(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, new TextEncoder().encode(payload)));

test('canonicalize ordena chaves de forma determinística', () => {
  assert.strictEqual(canonicalize({ b: 1, a: [{ d: 1, c: 2 }] }), '{"a":[{"c":2,"d":1}],"b":1}');
});

test('assinatura do WebCrypto é verificada pelo servidor', async () => {
  const { kp, jwk } = await newKeys();
  const payload = buildPayload(fakeExpense(), 'mgr1', '2026-01-04T00:00:00.000Z');
  const sig = await sign(kp.privateKey, payload);
  assert.ok(verifySignature(payload, sig, normalizePublicJwk(jwk)));
});

test('alterar o documento invalida a assinatura (integridade)', async () => {
  const { kp, jwk } = await newKeys();
  const payload = buildPayload(fakeExpense(), 'mgr1', '2026-01-04T00:00:00.000Z');
  const sig = await sign(kp.privateKey, payload);
  const tampered = fakeExpense();
  tampered.total = 5000;
  const other = buildPayload(tampered, 'mgr1', '2026-01-04T00:00:00.000Z');
  assert.notStrictEqual(other, payload);
  assert.ok(!verifySignature(other, sig, jwk));
});

test('assinatura de outra chave é rejeitada (autenticidade)', async () => {
  const a = await newKeys();
  const b = await newKeys();
  const payload = buildPayload(fakeExpense(), 'mgr1', '2026-01-04T00:00:00.000Z');
  const sig = await sign(a.kp.privateKey, payload);
  assert.ok(!verifySignature(payload, sig, b.jwk));
});

test('normalizePublicJwk rejeita chave privada e curvas erradas', async () => {
  const { kp } = await newKeys();
  const priv = await subtle.exportKey('jwk', kp.privateKey);
  assert.throws(() => normalizePublicJwk(priv));
  assert.throws(() => normalizePublicJwk({ kty: 'RSA' }));
  assert.throws(() => normalizePublicJwk({ kty: 'EC', crv: 'P-256', x: 'AAAA', y: 'AAAA' }));
});

test('fingerprint é estável', async () => {
  const { jwk } = await newKeys();
  assert.strictEqual(jwkFingerprint(jwk), jwkFingerprint(normalizePublicJwk(jwk)));
  assert.strictEqual(jwkFingerprint(jwk).length, 64);
  assert.strictEqual(sha256Hex('a').length, 64);
});
