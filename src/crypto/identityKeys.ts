import { encryptAead, decryptAead, type AeadCiphertext } from './aead'
import { generateX25519KeyPair } from './ecdh'
import { getDb } from '../storage/db'

const IDENTITY_KEY_ID = 'identity-x25519'
const IDENTITY_AAD_LABEL = new TextEncoder().encode('retrochat:identity:x25519:v1')

export type IdentityPublicKey = {
  algorithm: 'x25519'
  publicKey: string // hex
}

type IdentityKeyRecord = {
  publicKeyHex: string
  privateKeyHex: string
}

export class IdentityKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IdentityKeyError'
  }
}

export function toHex(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array)) {
    throw new IdentityKeyError('toHex: expected Uint8Array')
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function fromHex(hex: string): Uint8Array {
  if (typeof hex !== 'string') {
    throw new IdentityKeyError('fromHex: expected string')
  }
  if (hex.length % 2 !== 0) {
    throw new IdentityKeyError('Invalid hex string length.')
  }
  // Validate hex characters
  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    throw new IdentityKeyError('Invalid hex string: contains non-hex characters')
  }
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    const parsed = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(parsed)) {
      throw new IdentityKeyError(`Invalid hex byte at position ${i * 2}`)
    }
    out[i] = parsed
  }
  return out
}

export async function getOrCreateIdentityKeyPair(dsk: CryptoKey): Promise<{
  publicKey: IdentityPublicKey
  privateKey: Uint8Array
}> {
  let db
  try {
    db = await getDb()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new IdentityKeyError(`Failed to open database: ${message}`)
  }

  let existing
  try {
    existing = await db.get('keys', IDENTITY_KEY_ID)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new IdentityKeyError(`Failed to read identity key from database: ${message}`)
  }

  if (existing) {
    const record = await decryptIdentityRecord(existing.blob, dsk)
    return {
      publicKey: {
        algorithm: 'x25519',
        publicKey: record.publicKeyHex,
      },
      privateKey: fromHex(record.privateKeyHex),
    }
  }

  // Generate new identity keypair and persist encrypted private key.
  const { publicKey, privateKey } = generateX25519KeyPair()
  const record: IdentityKeyRecord = {
    publicKeyHex: toHex(publicKey),
    privateKeyHex: toHex(privateKey),
  }

  let payload: Uint8Array
  try {
    payload = new TextEncoder().encode(JSON.stringify(record))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new IdentityKeyError(`Failed to serialize identity key record: ${message}`)
  }

  const blob = await encryptAead({
    key: dsk,
    plaintext: payload,
    aad: IDENTITY_AAD_LABEL,
  })

  const now = new Date().toISOString()
  try {
    await db.put('keys', {
      id: IDENTITY_KEY_ID,
      blob,
      createdAt: now,
      updatedAt: now,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new IdentityKeyError(`Failed to save identity key to database: ${message}`)
  }

  return {
    publicKey: {
      algorithm: 'x25519',
      publicKey: record.publicKeyHex,
    },
    privateKey,
  }
}

export async function getIdentityPublicKey(dsk: CryptoKey): Promise<IdentityPublicKey | null> {
  let db
  try {
    db = await getDb()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new IdentityKeyError(`Failed to open database: ${message}`)
  }

  let existing
  try {
    existing = await db.get('keys', IDENTITY_KEY_ID)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new IdentityKeyError(`Failed to read identity key from database: ${message}`)
  }

  if (!existing) {
    return null
  }

  const record = await decryptIdentityRecord(existing.blob, dsk)
  return {
    algorithm: 'x25519',
    publicKey: record.publicKeyHex,
  }
}

function validateIdentityKeyRecord(record: unknown): asserts record is IdentityKeyRecord {
  if (typeof record !== 'object' || record === null) {
    throw new IdentityKeyError('Invalid identity key record: expected object')
  }
  const r = record as Record<string, unknown>
  if (typeof r.publicKeyHex !== 'string' || r.publicKeyHex.length === 0) {
    throw new IdentityKeyError('Invalid identity key record: missing or invalid publicKeyHex')
  }
  if (typeof r.privateKeyHex !== 'string' || r.privateKeyHex.length === 0) {
    throw new IdentityKeyError('Invalid identity key record: missing or invalid privateKeyHex')
  }
  // Validate hex format
  if (!/^[0-9a-fA-F]+$/.test(r.publicKeyHex)) {
    throw new IdentityKeyError('Invalid identity key record: publicKeyHex is not valid hex')
  }
  if (!/^[0-9a-fA-F]+$/.test(r.privateKeyHex)) {
    throw new IdentityKeyError('Invalid identity key record: privateKeyHex is not valid hex')
  }
}

async function decryptIdentityRecord(
  blob: AeadCiphertext,
  dsk: CryptoKey,
): Promise<IdentityKeyRecord> {
  const payload = await decryptAead({
    key: dsk,
    record: blob,
    aad: IDENTITY_AAD_LABEL,
  })
  const decoded = new TextDecoder().decode(payload)
  
  let record: unknown
  try {
    record = JSON.parse(decoded)
  } catch (err) {
    throw new IdentityKeyError('Failed to parse identity key record: invalid JSON')
  }
  
  // Validate the parsed record structure
  validateIdentityKeyRecord(record)
  
  return record
}

