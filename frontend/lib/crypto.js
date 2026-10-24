/**
 * Assinatura digital no navegador com a Web Cryptography API.
 * - Algoritmo: ECDSA P-256 + SHA-256 (saída r||s, formato IEEE P1363).
 * - A chave PRIVADA é gerada como NÃO EXTRAÍVEL e guardada como CryptoKey no IndexedDB:
 *   nem o JavaScript da página consegue ler seus bytes, e ela nunca é enviada ao servidor.
 */
const subtle = () => globalThis.crypto.subtle;
const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_ALG = { name: 'ECDSA', hash: 'SHA-256' };

const enc = (s) => new TextEncoder().encode(s);
export const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
export const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
export const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(text) {
  return toHex(await subtle().digest('SHA-256', enc(text)));
}

// ---------- IndexedDB ----------
const DB = 'assinatura-digital';
const STORE = 'keys';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idb(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}
export const loadKeyPair = (userId) => idb('readonly', (s) => s.get(userId));
export const saveKeyPair = (userId, pair) => idb('readwrite', (s) => s.put(pair, userId));

// ---------- Chaves ----------
export async function generateKeyPair() {
  // extractable=false => a chave privada não pode ser exportada; a pública sempre pode
  return subtle().generateKey(ALG, false, ['sign', 'verify']);
}
export const exportPublicJwk = async (publicKey) => {
  const { kty, crv, x, y } = await subtle().exportKey('jwk', publicKey);
  return { kty, crv, x, y };
};

/** Mesma canonicalização do servidor: fingerprint = SHA-256 de {crv,kty,x,y} com chaves ordenadas. */
export async function fingerprintOf(jwk) {
  return sha256Hex(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }));
}

// ---------- Assinar / verificar ----------
export async function signPayload(privateKey, payload) {
  return toB64(await subtle().sign(SIGN_ALG, privateKey, enc(payload)));
}

export async function verifyPayload(jwk, payload, signatureB64) {
  const key = await subtle().importKey('jwk', jwk, ALG, false, ['verify']);
  return subtle().verify(SIGN_ALG, key, fromB64(signatureB64), enc(payload));
}
