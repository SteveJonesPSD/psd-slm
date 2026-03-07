/**
 * lib/crypto.ts
 * AES-256-GCM field encryption and HMAC blind indexes.
 * SERVER-SIDE ONLY — uses Node.js crypto module.
 * Never import this in client components.
 */
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto'

const KEY_HEX = process.env.FIELD_ENCRYPTION_KEY
const PEPPER_HEX = process.env.BLIND_INDEX_PEPPER

function getKey(): Buffer {
  if (!KEY_HEX) throw new Error('FIELD_ENCRYPTION_KEY env var not set')
  return Buffer.from(KEY_HEX, 'hex')
}

function getPepper(): Buffer {
  if (!PEPPER_HEX) throw new Error('BLIND_INDEX_PEPPER env var not set')
  return Buffer.from(PEPPER_HEX, 'hex')
}

/**
 * Encrypt a plaintext string.
 * Returns: base64(iv):base64(authTag):base64(ciphertext)
 * Each call produces different ciphertext (random IV) — this is correct.
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12) // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

/**
 * Decrypt a ciphertext string produced by encrypt().
 * Throws if tampered or key is wrong.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey()
  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('Invalid ciphertext format')

  const [ivB64, authTagB64, encryptedB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const encrypted = Buffer.from(encryptedB64, 'base64')

  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString('utf8')
}

/**
 * Compute a stable HMAC-SHA256 blind index for equality lookups.
 * Always normalise the input before calling (e.g. .toLowerCase().trim()).
 * Same input + same pepper = same output every time (deterministic).
 */
export function blindIndex(value: string): string {
  return createHmac('sha256', getPepper())
    .update(value)
    .digest('hex')
}
