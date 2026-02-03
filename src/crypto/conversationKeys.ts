import { utf8ToBytes } from '@noble/hashes/utils.js'
import { deriveSharedSecret, X25519ValidationError } from './ecdh'
import { hkdfSha256 } from './kdf'

const CONVERSATION_SALT = utf8ToBytes('retrochat:conversation:salt:v1')
const X25519_KEY_LENGTH = 32
// Use 16 bytes (128 bits) for conversation ID to reduce collision risk
const CONVERSATION_ID_LENGTH = 16

export type ConversationKeySpec = {
  key: CryptoKey
  id: string
}

export class ConversationKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConversationKeyError'
  }
}

function validateAddress(address: string, label: string): void {
  if (typeof address !== 'string') {
    throw new ConversationKeyError(`Invalid ${label}: expected string`)
  }
  if (address.trim().length === 0) {
    throw new ConversationKeyError(`Invalid ${label}: address cannot be empty`)
  }
  // Basic Ethereum address validation (0x followed by 40 hex chars)
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/
  if (!ethAddressRegex.test(address)) {
    throw new ConversationKeyError(`Invalid ${label}: not a valid Ethereum address format`)
  }
}

function validateKey(key: Uint8Array, label: string): void {
  if (!(key instanceof Uint8Array)) {
    throw new ConversationKeyError(`Invalid ${label}: expected Uint8Array`)
  }
  if (key.length !== X25519_KEY_LENGTH) {
    throw new ConversationKeyError(
      `Invalid ${label}: expected ${X25519_KEY_LENGTH} bytes, got ${key.length}`
    )
  }
}

function validateEpoch(epoch: number): void {
  if (typeof epoch !== 'number' || !Number.isInteger(epoch) || epoch < 0) {
    throw new ConversationKeyError('Invalid epoch: must be a non-negative integer')
  }
}

export async function deriveConversationKey(options: {
  myPrivateKey: Uint8Array
  peerPublicKey: Uint8Array
  myAddress: string
  peerAddress: string
  epoch?: number
}): Promise<ConversationKeySpec> {
  const { myPrivateKey, peerPublicKey, myAddress, peerAddress, epoch = 0 } = options

  // Validate all inputs before processing
  validateKey(myPrivateKey, 'myPrivateKey')
  validateKey(peerPublicKey, 'peerPublicKey')
  validateAddress(myAddress, 'myAddress')
  validateAddress(peerAddress, 'peerAddress')
  validateEpoch(epoch)

  let sharedSecret: Uint8Array
  try {
    sharedSecret = deriveSharedSecret({ privateKey: myPrivateKey, peerPublicKey })
  } catch (err) {
    if (err instanceof X25519ValidationError) {
      throw new ConversationKeyError(`Key derivation failed: ${err.message}`)
    }
    throw err
  }

  const [a, b] = [myAddress.toLowerCase(), peerAddress.toLowerCase()].sort()
  const infoString = `retrochat:conversation:hkdf:v1|${a}|${b}|epoch=${epoch}`
  const info = utf8ToBytes(infoString)

  const keyMaterial = await hkdfSha256({
    ikm: sharedSecret,
    salt: CONVERSATION_SALT,
    info,
    length: 32, // 256-bit AES key
  })

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new ConversationKeyError('WebCrypto is not available in this environment.')
  }

  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial.buffer as ArrayBuffer,
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  )

  // Use 16 bytes (128 bits) for conversation ID to reduce collision risk
  // (previously used 8 bytes which has higher collision probability)
  const id = Array.from(keyMaterial.slice(0, CONVERSATION_ID_LENGTH))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return { key, id }
}

