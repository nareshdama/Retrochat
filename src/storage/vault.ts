import type { StoreName, EncryptedBlob, VaultRow } from './db'
import { getDb } from './db'
import { decryptAead, encryptAead } from '../crypto/aead'

export type VaultPutOptions = {
  store: StoreName
  id: string
  key: CryptoKey
  plaintext: Uint8Array
  aad?: Uint8Array
}

export type VaultGetOptions = {
  store: StoreName
  id: string
  key: CryptoKey
  aad?: Uint8Array
}

export async function putEncryptedRecord(options: VaultPutOptions): Promise<void> {
  const { store, id, key, plaintext, aad } = options
  const db = await getDb()

  const blob: EncryptedBlob = await encryptAead({ key, plaintext, aad })
  const now = new Date().toISOString()

  const row: VaultRow = {
    id,
    blob,
    createdAt: now,
    updatedAt: now,
  }

  await db.put(store, row)
}

export async function getDecryptedRecord(options: VaultGetOptions): Promise<Uint8Array | null> {
  const { store, id, key, aad } = options
  const db = await getDb()

  const row = await db.get(store, id)
  if (!row) return null

  const plaintext = await decryptAead({ key, record: row.blob, aad })
  return plaintext
}

