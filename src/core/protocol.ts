import { sha256 } from '@noble/hashes/sha2.js'

export type MessageEnvelope = {
  v: number // protocol version
  from: string // EIP-55 address
  to: string // EIP-55 address
  ts: string // ISO 8601 timestamp
  nonce: string // hex-encoded random nonce
  iv: string // hex-encoded IV used for AES-GCM encryption
  ciphertext: string // hex-encoded AES-GCM ciphertext
  aad?: string // hex-encoded additional authenticated data (optional)
}

export type MessageId = string // hex-encoded sha256(nonce + ciphertext)

export { type MessageId as MessageIdType }

export function deriveMessageId(envelope: MessageEnvelope): MessageId {
  // NOTE: This is a deterministic identifier; it is NOT a secret.
  // messageId = sha256(nonce + ciphertext)
  // Keep in sync with storage layer.
  const combined = `${envelope.nonce}${envelope.ciphertext}`
  const bytes = new TextEncoder().encode(combined)
  const hash = sha256(bytes)
  return Array.from(hash)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
