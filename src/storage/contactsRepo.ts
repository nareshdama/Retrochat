import { sha256 } from '@noble/hashes/sha2.js'
import { utf8ToBytes } from '@noble/hashes/utils.js'
import { getAddress, isAddress } from 'viem'
import { getDb } from './db'
import type { StoreName, VaultRow } from './db'
import { decryptAead, encryptAead } from '../crypto/aead'

const CONTACTS_AAD_LABEL = new TextEncoder().encode('retrochat:contacts:v1')
const CONTACTS_STORE: StoreName = 'contacts'

export type Contact = {
  id: string
  address: string // EIP-55 checksummed
  label: string
  note?: string
  publicKeyHex?: string // X25519 public key for E2E encryption
  createdAt: string
  updatedAt: string
}

function normalizeAddress(input: string): string {
  const trimmed = input.trim()
  if (!isAddress(trimmed)) {
    throw new Error('Invalid wallet address format.')
  }
  // getAddress returns EIP-55 checksummed address.
  return getAddress(trimmed)
}

function deriveContactId(address: string): string {
  const lower = address.toLowerCase()
  const hash = sha256(utf8ToBytes(lower))
  return Array.from(hash)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function decryptContactRow(row: VaultRow, dsk: CryptoKey): Promise<Contact> {
  const payload = await decryptAead({
    key: dsk,
    record: row.blob,
    aad: CONTACTS_AAD_LABEL,
  })
  const decoded = new TextDecoder().decode(payload)
  const data = JSON.parse(decoded) as { address: string; label: string; note?: string; publicKeyHex?: string }

  return {
    id: row.id,
    address: data.address,
    label: data.label,
    note: data.note,
    publicKeyHex: data.publicKeyHex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function listContacts(dsk: CryptoKey): Promise<Contact[]> {
  const db = await getDb()
  const rows = await db.getAll(CONTACTS_STORE)

  const contacts: Contact[] = []
  for (const row of rows) {
    // Best-effort: skip rows that fail to decrypt rather than crashing the whole list.
    try {
      const contact = await decryptContactRow(row, dsk)
      contacts.push(contact)
    } catch {
      // ignore corrupted rows
    }
  }

  // Order by updatedAt descending (most recent first)
  return contacts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function searchContacts(params: {
  dsk: CryptoKey
  query: string
}): Promise<Contact[]> {
  const { dsk, query } = params
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return listContacts(dsk)
  }

  const all = await listContacts(dsk)
  return all.filter((c) => {
    const inLabel = c.label.toLowerCase().includes(normalizedQuery)
    const inAddress = c.address.toLowerCase().includes(normalizedQuery)
    return inLabel || inAddress
  })
}

export async function createContact(params: {
  dsk: CryptoKey
  address: string
  label: string
  note?: string
  publicKeyHex?: string
}): Promise<Contact> {
  const { dsk, address, label, note, publicKeyHex } = params
  const checksummed = normalizeAddress(address)
  const id = deriveContactId(checksummed)

  // Prepare encrypted payload before starting transaction
  const payload = new TextEncoder().encode(
    JSON.stringify({
      address: checksummed,
      label,
      note,
      publicKeyHex,
    }),
  )

  const blob = await encryptAead({
    key: dsk,
    plaintext: payload,
    aad: CONTACTS_AAD_LABEL,
  })

  const now = new Date().toISOString()
  const row: VaultRow = {
    id,
    blob,
    createdAt: now,
    updatedAt: now,
  }

  const db = await getDb()
  
  // Use a transaction to ensure atomic check-then-insert
  const tx = db.transaction(CONTACTS_STORE, 'readwrite')
  const store = tx.objectStore(CONTACTS_STORE)
  
  try {
    const existing = await store.get(id)
    if (existing) {
      // Abort transaction and throw error
      tx.abort()
      throw new Error('A contact with this address already exists.')
    }

    await store.put(row)
    await tx.done
  } catch (err) {
    // Re-throw the "already exists" error, otherwise wrap in a storage error
    if (err instanceof Error && err.message.includes('already exists')) {
      throw err
    }
    throw new Error(`Failed to create contact: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }

  return {
    id,
    address: checksummed,
    label,
    note,
    publicKeyHex,
    createdAt: now,
    updatedAt: now,
  }
}

export async function updateContact(params: {
  dsk: CryptoKey
  id: string
  label: string
  note?: string
  publicKeyHex?: string
}): Promise<Contact> {
  const { dsk, id, label, note, publicKeyHex } = params
  const db = await getDb()
  
  // Use a transaction to ensure atomic read-modify-write
  const tx = db.transaction(CONTACTS_STORE, 'readwrite')
  const store = tx.objectStore(CONTACTS_STORE)

  try {
    const existing = await store.get(id)
    if (!existing) {
      tx.abort()
      throw new Error('Contact not found.')
    }

    const contact = await decryptContactRow(existing, dsk)

    const payload = new TextEncoder().encode(
      JSON.stringify({
        address: contact.address,
        label,
        note,
        publicKeyHex,
      }),
    )

    const blob = await encryptAead({
      key: dsk,
      plaintext: payload,
      aad: CONTACTS_AAD_LABEL,
    })

    const now = new Date().toISOString()
    const row: VaultRow = {
      id,
      blob,
      createdAt: contact.createdAt,
      updatedAt: now,
    }

    await store.put(row)
    await tx.done

    return {
      ...contact,
      label,
      note,
      publicKeyHex,
      updatedAt: now,
    }
  } catch (err) {
    // Re-throw known errors, otherwise wrap
    if (err instanceof Error && err.message === 'Contact not found.') {
      throw err
    }
    throw new Error(`Failed to update contact: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
}

export async function deleteContact(params: { id: string }): Promise<void> {
  const { id } = params
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid contact ID')
  }
  
  const db = await getDb()
  try {
    await db.delete(CONTACTS_STORE, id)
  } catch (err) {
    throw new Error(`Failed to delete contact: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
}

/**
 * Get a contact by wallet address. Returns undefined if not found.
 * Throws an error for critical failures (DB errors, decryption failures with valid key).
 */
export async function getContactByAddress(params: {
  dsk: CryptoKey
  address: string
}): Promise<Contact | undefined> {
  const { dsk, address } = params
  
  let checksummed: string
  try {
    checksummed = normalizeAddress(address)
  } catch {
    // Invalid address format - return undefined rather than throwing
    return undefined
  }
  
  const id = deriveContactId(checksummed)
  
  let db
  try {
    db = await getDb()
  } catch (err) {
    throw new Error(`Database error: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
  
  const row = await db.get(CONTACTS_STORE, id)
  if (!row) return undefined
  
  try {
    return await decryptContactRow(row, dsk)
  } catch (err) {
    // Log decryption failure for debugging but return undefined to avoid breaking flows
    console.warn('Failed to decrypt contact row:', err)
    return undefined
  }
}

