import { base64ToBytes, bytesToBase64 } from '../core/base64.js';

// La cassaforte del token GitHub su questo dispositivo. Il token non resta mai in chiaro: viene cifrato con una
// password scelta da te (PBKDF2 + AES-GCM, tramite le funzioni di cifratura del browser). Senza la password
// il contenuto salvato non serve a nulla.

const KEY = 'stampe3d:admin-vault';
const ITERATIONS = 310_000;

export class VaultError extends Error {
  constructor(code) {
    super(code);
    this.name = 'VaultError';
    this.code = code; // 'password' | 'unavailable'
  }
}

async function deriveKey(passphrase, salt, iterations) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export class TokenVault {
  #storage;

  constructor(storage = window.localStorage) {
    this.#storage = storage;
  }

  get exists() {
    try {
      return this.#storage.getItem(KEY) !== null;
    } catch {
      return false;
    }
  }

  /** `secret` è un oggetto semplice ({ repo, token }). */
  async save(secret, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt, ITERATIONS);
    const plain = new TextEncoder().encode(JSON.stringify(secret));
    const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
    const record = { v: 1, n: ITERATIONS, s: bytesToBase64(salt), i: bytesToBase64(iv), d: bytesToBase64(sealed) };
    try {
      this.#storage.setItem(KEY, JSON.stringify(record));
    } catch {
      throw new VaultError('unavailable');
    }
  }

  async open(passphrase) {
    let record;
    try {
      record = JSON.parse(this.#storage.getItem(KEY));
    } catch {
      record = null;
    }
    if (!record) throw new VaultError('unavailable');
    try {
      const key = await deriveKey(passphrase, base64ToBytes(record.s), record.n);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(record.i) }, key, base64ToBytes(record.d));
      return JSON.parse(new TextDecoder().decode(plain));
    } catch {
      // AES-GCM autentica il contenuto: una password sbagliata fallisce qui, senza rivelare nulla.
      throw new VaultError('password');
    }
  }

  clear() {
    try {
      this.#storage.removeItem(KEY);
    } catch { /* niente da cancellare */ }
  }
}
