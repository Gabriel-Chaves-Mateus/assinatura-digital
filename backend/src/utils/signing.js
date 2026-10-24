const crypto = require('crypto');

/** JSON canônico: chaves ordenadas recursivamente, sem espaços. */
function canonicalize(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  if (value && typeof value === 'object') {
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonicalize(value[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

const sha256Hex = (data) => crypto.createHash('sha256').update(data).digest('hex');

/**
 * Monta o documento que será assinado a partir do estado ATUAL da despesa.
 * Qualquer alteração em valores, itens, recibos ou validação muda o payload
 * e invalida a assinatura (integridade).
 */
function buildPayload(expense, signerId, issuedAt) {
  const doc = {
    v: 1,
    type: 'expense-report',
    expenseId: expense._id.toString(),
    employeeId: expense.employee.toString(),
    title: expense.title,
    description: expense.description || '',
    items: expense.items.map((i) => ({ description: i.description, amount: i.amount, date: i.date })),
    total: expense.total,
    receipts: expense.receipts.map((r) => ({ filename: r.filename, sha256: r.sha256, size: r.size })),
    validatedBy: expense.validatedBy ? expense.validatedBy.toString() : null,
    validatedAt: expense.validatedAt ? new Date(expense.validatedAt).toISOString() : null,
    signerId: signerId.toString(),
    issuedAt,
  };
  return canonicalize(doc);
}

/** Fingerprint = SHA-256 do JWK público canônico (apenas campos EC essenciais). */
function jwkFingerprint(jwk) {
  return sha256Hex(canonicalize({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }));
}

/** Valida e normaliza um JWK público EC P-256 enviado pelo cliente. */
function normalizePublicJwk(jwk) {
  if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || typeof jwk.x !== 'string' || typeof jwk.y !== 'string') {
    throw new Error('Chave pública inválida: esperado JWK EC P-256');
  }
  if (jwk.d) throw new Error('Chave privada não deve ser enviada ao servidor');
  const clean = { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
  // Garante que o ponto é válido na curva (lança erro se não for)
  crypto.createPublicKey({ key: clean, format: 'jwk' });
  return clean;
}

/** Verifica assinatura ECDSA P-256/SHA-256 no formato do WebCrypto (r||s). */
function verifySignature(payload, signatureB64, jwk) {
  try {
    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    return crypto.verify(
      'sha256',
      Buffer.from(payload, 'utf8'),
      { key, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signatureB64, 'base64')
    );
  } catch {
    return false;
  }
}

module.exports = { canonicalize, sha256Hex, buildPayload, jwkFingerprint, normalizePublicJwk, verifySignature };
