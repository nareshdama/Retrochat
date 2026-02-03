import { sha256 } from '@noble/hashes/sha2.js'
import { getDb } from './db'
import type { VaultRow } from './db'
import { decryptAead, encryptAead } from '../crypto/aead'
import type { MessageEnvelope } from '../core/protocol'
import type { MessageId } from '../core/protocol'

const MESSAGES_AAD_LABEL = new TextEncoder().encode('retrochat:messages:v1')
const MESSAGES_STORE = 'messages'
const PROTOCOL_VERSION = 1

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}


function deriveMessageId(envelope: MessageEnvelope): MessageId {
  const { nonce, ciphertext } = envelope
  const combined = `${nonce}${ciphertext}`
  const hash = sha256(new TextEncoder().encode(combined))
  return toHex(hash)
}

type MessageRecord = {
  envelope: MessageEnvelope
}

async function decryptMessageRow(
  row: VaultRow,
  conversationKey: CryptoKey,
): Promise<MessageEnvelope> {
  const payload = await decryptAead({
    key: conversationKey,
    record: row.blob,
    aad: MESSAGES_AAD_LABEL,
  })
  const decoded = new TextDecoder().decode(payload)
  const record = JSON.parse(decoded) as MessageRecord

  // Verify messageId matches envelope content (tamper detection).
  const computedId = deriveMessageId(record.envelope)
  if (computedId !== row.id) {
    throw new Error('Message ID mismatch: tampering detected.')
  }

  return record.envelope
}

export async function storeMessage(options: {
  conversationKey: CryptoKey
  envelope: MessageEnvelope
}): Promise<MessageId> {
  const { conversationKey, envelope } = options

  if (envelope.v !== PROTOCOL_VERSION) {
    throw new Error(`Unsupported protocol version: ${envelope.v}`)
  }

  const messageId = deriveMessageId(envelope)

  // Prepare encrypted payload before starting transaction
  const record: MessageRecord = { envelope }
  const payload = new TextEncoder().encode(JSON.stringify(record))
  const blob = await encryptAead({
    key: conversationKey,
    plaintext: payload,
    aad: MESSAGES_AAD_LABEL,
  })

  const now = envelope.ts || new Date().toISOString()
  const row: VaultRow = {
    id: messageId,
    blob,
    createdAt: now,
    updatedAt: now,
  }

  const db = await getDb()
  
  // Use a transaction to ensure atomic check-then-insert
  const tx = db.transaction(MESSAGES_STORE, 'readwrite')
  const store = tx.objectStore(MESSAGES_STORE)

  try {
    const existing = await store.get(messageId)
    if (existing) {
      // Message already exists; return existing ID (idempotent).
      // No need to abort - just don't write
      return messageId
    }

    await store.put(row)
    await tx.done
    return messageId
  } catch (err) {
    throw new Error(`Failed to store message: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
}

export async function getMessage(options: {
  messageId: MessageId
  conversationKey: CryptoKey
}): Promise<MessageEnvelope | null> {
  const { messageId, conversationKey } = options
  const db = await getDb()
  const row = await db.get(MESSAGES_STORE, messageId)

  if (!row) {
    return null
  }

  try {
    return decryptMessageRow(row, conversationKey)
  } catch (error) {
    if (error instanceof Error && error.message.includes('tampering')) {
      throw error
    }
    // Decrypt failure = tamper detection.
    throw new Error('Message decryption failed: tampering detected or wrong key.')
  }
}

export type PaginationOptions = {
  conversationKey: CryptoKey
  limit?: number
  before?: string // ISO timestamp
  after?: string // ISO timestamp
}

export async function listMessages(options: PaginationOptions): Promise<MessageEnvelope[]> {
  const { conversationKey, limit = 50, before, after } = options
  const db = await getDb()

  const tx = db.transaction(MESSAGES_STORE, 'readonly')
  const store = tx.store
  const index = store.index('by-timestamp')
  let cursor = await index.openCursor(null, 'prev')

  const messages: MessageEnvelope[] = []
  let count = 0

  while (cursor && count < limit) {
    const row = cursor.value as VaultRow

    if (before && row.updatedAt >= before) {
      await cursor.continue()
      continue
    }

    if (after && row.updatedAt <= after) {
      break
    }

    try {
      const envelope = await decryptMessageRow(row, conversationKey)
      messages.push(envelope)
      count += 1
    } catch {
      // Skip corrupted/tampered messages
    }

    await cursor.continue()
  }

  // Sort by timestamp descending (newest first)
  return messages.sort((a, b) => b.ts.localeCompare(a.ts))
}

export async function deleteMessage(options: {
  messageId: MessageId
}): Promise<void> {
  const { messageId } = options
  if (!messageId || typeof messageId !== 'string') {
    throw new Error('Invalid message ID')
  }
  
  const db = await getDb()
  try {
    await db.delete(MESSAGES_STORE, messageId)
  } catch (err) {
    throw new Error(`Failed to delete message: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
}
