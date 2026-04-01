/**
 * Token encryption/decryption for Supabase Edge Functions (Deno).
 * Same algorithm as src/lib/tokenCrypto.ts — AES-256-GCM with PBKDF2.
 * Backward compatible: plaintext tokens returned as-is.
 */

const ENC_PREFIX = 'enc:';
const DEFAULT_SECRET = 'sdcoach-tok-k3y-2024-appmax';

function getSecret(): string {
  return Deno.env.get('TOKEN_SECRET') || DEFAULT_SECRET;
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
