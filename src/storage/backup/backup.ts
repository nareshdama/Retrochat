import { getDb, DB_NAME, DB_VERSION, type StoreName, type VaultRow } from '../db'
import { randomBytes } from '../../crypto/random'
import { resetVault } from '../db'
import { EncryptedBackupFileSchema } from '../../core/validate/backup'

const BACKUP_AAD = new TextEncoder().encode('retrochat:backup:v1')
const PBKDF2_ITERATIONS = 200_000

type HexString = string

type BackupRowJson = {
  id: string
  blob: { ivHex: HexString; ciphertextHex: HexString }
  createdAt: string
  updatedAt: string
}

type BackupPayloadV1 = {
  format: 'retrochat.vault.payload'
  v: 1
  exportedAt: string
  db: { name: string; version: number }
  stores: Record<StoreName, BackupRowJson[]>
}

export type EncryptedBackupFileV1 = {
  format: 'retrochat.encrypted-backup'
  v: 1
  createdAt: string
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    saltHex: HexString
    iterations: number
  }
  aead: {
    name: 'AES-GCM'
    ivHex: HexString
    aadLabel: 'retrochat:backup:v1'
  }
  ciphertextHex: HexString
  plaintextHashHex: HexString
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string length.')
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string') throw new Error(`Invalid ${label}: expected string.`)
}

function assertNumber(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Invalid ${label}: expected number.`)
  }
}

function assertStoreName(value: unknown): asserts value is StoreName {
  if (value !== 'keys' && value !== 'contacts' && value !== 'conversations' && value !== 'messages' && value !== 'settings') {
    throw new Error('Invalid store name in backup.')
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto is not available in this environment.')
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer as ArrayBuffer)
  return toHex(new Uint8Array(digest))
}

async function deriveBackupKey(options: {
  passphrase: string
  salt: Uint8Array
  iterations: number
}): Promise<CryptoKey> {
  const { passphrase, salt, iterations } = options
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto is not available in this environment.')
  }

  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase).buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt as unknown as BufferSource,
      iterations,
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptBackupPayload(options: {
  key: CryptoKey
  iv: Uint8Array
  plaintext: Uint8Array
}): Promise<Uint8Array> {
  const { key, iv, plaintext } = options
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto is not available in this environment.')
  }
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource, additionalData: BACKUP_AAD as unknown as BufferSource },
    key,
    plaintext.buffer as ArrayBuffer,
  )
  return new Uint8Array(ciphertext)
}

async function decryptBackupPayload(options: {
  key: CryptoKey
  iv: Uint8Array
  ciphertext: Uint8Array
}): Promise<Uint8Array> {
  const { key, iv, ciphertext } = options
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto is not available in this environment.')
  }
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource, additionalData: BACKUP_AAD as unknown as BufferSource },
      key,
      ciphertext.buffer as ArrayBuffer,
    )
    return new Uint8Array(plaintext)
  } catch {
    // AES-GCM auth failure is an integrity failure (wrong passphrase or tampering).
    throw new Error('Backup integrity check failed (wrong passphrase or tampered file).')
  }
}

function serializeRow(row: VaultRow): BackupRowJson {
  return {
    id: row.id,
    blob: {
      ivHex: toHex(row.blob.iv),
      ciphertextHex: toHex(row.blob.ciphertext),
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function deserializeRow(row: BackupRowJson): VaultRow {
  return {
    id: row.id,
    blob: {
      iv: fromHex(row.blob.ivHex),
      ciphertext: fromHex(row.blob.ciphertextHex),
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function validateBackupPayloadV1(payload: unknown): asserts payload is BackupPayloadV1 {
  if (!isRecord(payload)) throw new Error('Invalid backup payload: expected object.')

  if (payload.format !== 'retrochat.vault.payload') throw new Error('Invalid backup payload format.')
  if (payload.v !== 1) throw new Error('Unsupported backup payload version.')

  assertString(payload.exportedAt, 'payload.exportedAt')

  if (!isRecord(payload.db)) throw new Error('Invalid payload.db.')
  assertString(payload.db.name, 'payload.db.name')
  assertNumber(payload.db.version, 'payload.db.version')

  if (!isRecord(payload.stores)) throw new Error('Invalid payload.stores.')

  const storeNames = Object.keys(payload.stores)
  for (const s of storeNames) {
    assertStoreName(s)
    const rows = payload.stores[s]
    if (!Array.isArray(rows)) throw new Error(`Invalid payload.stores.${s}: expected array.`)
    for (const r of rows) {
      if (!isRecord(r)) throw new Error(`Invalid row in ${s}: expected object.`)
      assertString(r.id, `${s}.row.id`)
      assertString(r.createdAt, `${s}.row.createdAt`)
      assertString(r.updatedAt, `${s}.row.updatedAt`)
      if (!isRecord(r.blob)) throw new Error(`Invalid row blob in ${s}.`)
      assertString(r.blob.ivHex, `${s}.row.blob.ivHex`)
      assertString(r.blob.ciphertextHex, `${s}.row.blob.ciphertextHex`)

      const iv = fromHex(r.blob.ivHex)
      const ct = fromHex(r.blob.ciphertextHex)
      if (iv.length !== 12) throw new Error(`Invalid IV length in ${s} row (expected 12 bytes).`)
      if (ct.length === 0) throw new Error(`Invalid ciphertext length in ${s} row.`)
    }
  }
}

function validateEncryptedBackupFileV1(file: unknown): asserts file is EncryptedBackupFileV1 {
  if (!isRecord(file)) throw new Error('Invalid backup file: expected object.')
  if (file.format !== 'retrochat.encrypted-backup') throw new Error('Invalid backup format.')
  if (file.v !== 1) throw new Error('Unsupported backup version.')

  assertString(file.createdAt, 'createdAt')
  if (!isRecord(file.kdf)) throw new Error('Invalid kdf.')
  if (file.kdf.name !== 'PBKDF2') throw new Error('Unsupported kdf.')
  if (file.kdf.hash !== 'SHA-256') throw new Error('Unsupported kdf hash.')
  assertString(file.kdf.saltHex, 'kdf.saltHex')
  assertNumber(file.kdf.iterations, 'kdf.iterations')
  if (file.kdf.iterations < 50_000 || file.kdf.iterations > 2_000_000) {
    throw new Error('Backup KDF iterations out of allowed range.')
  }

  if (!isRecord(file.aead)) throw new Error('Invalid aead.')
  if (file.aead.name !== 'AES-GCM') throw new Error('Unsupported aead.')
  assertString(file.aead.ivHex, 'aead.ivHex')
  if (file.aead.aadLabel !== 'retrochat:backup:v1') throw new Error('Unexpected backup AAD label.')

  assertString(file.ciphertextHex, 'ciphertextHex')
  assertString(file.plaintextHashHex, 'plaintextHashHex')

  const salt = fromHex(file.kdf.saltHex)
  const iv = fromHex(file.aead.ivHex)
  const ct = fromHex(file.ciphertextHex)
  const hash = fromHex(file.plaintextHashHex)

  if (salt.length !== 16) throw new Error('Invalid backup salt length (expected 16 bytes).')
  if (iv.length !== 12) throw new Error('Invalid backup IV length (expected 12 bytes).')
  if (ct.length === 0) throw new Error('Invalid backup ciphertext length.')
  if (hash.length !== 32) throw new Error('Invalid backup hash length (expected 32 bytes).')
}

export async function exportEncryptedBackup(options: {
  passphrase: string
}): Promise<EncryptedBackupFileV1> {
  const { passphrase } = options
  if (!passphrase || passphrase.trim().length < 8) {
    throw new Error('Passphrase must be at least 8 characters.')
  }

  const db = await getDb()
  const stores: StoreName[] = ['keys', 'contacts', 'conversations', 'messages', 'settings']

  const payload: BackupPayloadV1 = {
    format: 'retrochat.vault.payload',
    v: 1,
    exportedAt: new Date().toISOString(),
    db: { name: DB_NAME, version: DB_VERSION },
    stores: {
      keys: [],
      contacts: [],
      conversations: [],
      messages: [],
      settings: [],
    },
  }

  for (const store of stores) {
    const rows = await db.getAll(store)
    payload.stores[store] = rows.map(serializeRow)
  }

  const plaintext = new TextEncoder().encode(JSON.stringify(payload))
  const plaintextHashHex = await sha256Hex(plaintext)

  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = await deriveBackupKey({ passphrase, salt, iterations: PBKDF2_ITERATIONS })
  const ciphertext = await encryptBackupPayload({ key, iv, plaintext })

  return {
    format: 'retrochat.encrypted-backup',
    v: 1,
    createdAt: new Date().toISOString(),
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      saltHex: toHex(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    aead: {
      name: 'AES-GCM',
      ivHex: toHex(iv),
      aadLabel: 'retrochat:backup:v1',
    },
    ciphertextHex: toHex(ciphertext),
    plaintextHashHex,
  }
}

export async function importEncryptedBackup(options: {
  passphrase: string
  fileJson: unknown
  mode?: 'replace'
}): Promise<void> {
  const { passphrase, fileJson, mode = 'replace' } = options
  if (!passphrase || passphrase.trim().length < 8) {
    throw new Error('Passphrase must be at least 8 characters.')
  }
  if (mode !== 'replace') {
    throw new Error('Unsupported import mode.')
  }

  // Zod shape/version validation first (user-friendly, consistent errors).
  // Additional hex-length checks are done below.
  EncryptedBackupFileSchema.parse(fileJson)
  validateEncryptedBackupFileV1(fileJson)

  const salt = fromHex(fileJson.kdf.saltHex)
  const iv = fromHex(fileJson.aead.ivHex)
  const ciphertext = fromHex(fileJson.ciphertextHex)
  const expectedHashHex = fileJson.plaintextHashHex

  const key = await deriveBackupKey({ passphrase, salt, iterations: fileJson.kdf.iterations })
  const plaintextBytes = await decryptBackupPayload({ key, iv, ciphertext })

  const actualHashHex = await sha256Hex(plaintextBytes)
  if (actualHashHex !== expectedHashHex) {
    throw new Error('Backup integrity check failed (hash mismatch).')
  }

  let payloadUnknown: unknown
  try {
    payloadUnknown = JSON.parse(new TextDecoder().decode(plaintextBytes)) as unknown
  } catch {
    throw new Error('Backup payload is not valid JSON.')
  }

  validateBackupPayloadV1(payloadUnknown)

  // CRITICAL: Pre-deserialize ALL rows BEFORE resetting vault to ensure data integrity.
  // If any row fails to deserialize, we abort before touching existing data.
  const stores: StoreName[] = ['keys', 'contacts', 'conversations', 'messages', 'settings']
  const preparedData: Map<StoreName, VaultRow[]> = new Map()

  for (const store of stores) {
    const rows = payloadUnknown.stores[store]
    const deserialized: VaultRow[] = []
    for (const row of rows) {
      try {
        const restored = deserializeRow(row)
        // Additional validation to ensure data is well-formed
        if (!restored.id || typeof restored.id !== 'string') {
          throw new Error(`Invalid row id in store ${store}`)
        }
        if (!restored.blob || !restored.blob.iv || !restored.blob.ciphertext) {
          throw new Error(`Invalid blob structure in store ${store}`)
        }
        deserialized.push(restored)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        throw new Error(`Failed to prepare backup data for store "${store}": ${message}`)
      }
    }
    preparedData.set(store, deserialized)
  }

  // Only reset vault AFTER all data has been validated and prepared successfully.
  // This prevents data loss if the backup file is corrupted.
  await resetVault()
  const db = await getDb()

  // Restore all prepared data
  for (const store of stores) {
    const rows = preparedData.get(store) || []
    for (const row of rows) {
      try {
        await db.put(store, row)
      } catch (err) {
        // If restoration fails after reset, log error but continue with remaining data
        // to salvage as much as possible. User should be warned about partial restore.
        console.error(`Failed to restore row in store "${store}":`, err)
        throw new Error(
          `Critical error during backup restoration in store "${store}". ` +
          `Some data may have been lost. Please contact support.`
        )
      }
    }
  }
}

