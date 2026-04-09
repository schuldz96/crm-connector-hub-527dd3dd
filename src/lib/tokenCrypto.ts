/**
 * Token encryption/decryption utility (AES-256-GCM).
 * Encrypts tokens at rest in the database.
 * Backward compatible: plaintext tokens (without "enc:" prefix) are returned as-is.
 */

const ENC_PREFIX = 'enc:';
const DEFAULT_SECRET = 'ltx-tok-k3y-2024';

function getSecret(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TOKEN_SECRET) {
    return import.meta.env.VITE_TOKEN_SECRET;
  }
  return DEFAULT_SECRET;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('sdcoach-token-salt'),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt a plaintext token. Returns "enc:<base64>" */
export async function encryptToken(plaintext: string): Promise<string> {
  if (!plaintext || plaintext.startsWith(ENC_PREFIX)) return plaintext;
  try {
    const key = await deriveKey(getSecret());
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return ENC_PREFIX + btoa(String.fromCharCode(...combined));
  } catch (e) {
    console.warn('[tokenCrypto] encrypt failed, storing plaintext:', e);
    return plaintext;
  }
}

/** Decrypt an encrypted token. Plaintext tokens (no "enc:" prefix) returned as-is. */
export async function decryptToken(stored: string): Promise<string> {
  if (!stored || !stored.startsWith(ENC_PREFIX)) return stored;
  try {
    const key = await deriveKey(getSecret());
    const raw = atob(stored.slice(ENC_PREFIX.length));
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.warn('[tokenCrypto] decrypt failed, returning raw value:', e);
    return stored;
  }
}

/** Decrypt multiple tokens in an account-like object. Returns new object with decrypted fields. */
export async function decryptAccountTokens<T extends Record<string, unknown>>(
  account: T,
  fields: string[] = ['access_token'],
): Promise<T> {
  const result = { ...account };
  for (const field of fields) {
    if (typeof result[field] === 'string') {
      (result as Record<string, unknown>)[field] = await decryptToken(result[field] as string);
    }
  }
  return result;
}
