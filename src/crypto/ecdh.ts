import { x25519 } from '@noble/curves/ed25519.js'

const X25519_KEY_LENGTH = 32

export type X25519KeyPair = {
  publicKey: Uint8Array
  privateKey: Uint8Array
}

export class X25519ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'X25519ValidationError'
  }
}

function validateX25519Key(key: Uint8Array, keyType: 'private' | 'public'): void {
  if (!(key instanceof Uint8Array)) {
    throw new X25519ValidationError(`Invalid ${keyType} key: expected Uint8Array`)
  }
  if (key.length !== X25519_KEY_LENGTH) {
    throw new X25519ValidationError(
      `Invalid ${keyType} key length: expected ${X25519_KEY_LENGTH} bytes, got ${key.length}`
    )
  }
  // Check for all-zero key (invalid for X25519)
  const isAllZero = key.every((b) => b === 0)
  if (isAllZero) {
    throw new X25519ValidationError(`Invalid ${keyType} key: key cannot be all zeros`)
  }
}

export function generateX25519KeyPair(): X25519KeyPair {
  const { secretKey, publicKey } = x25519.keygen()
  return { publicKey: new Uint8Array(publicKey), privateKey: new Uint8Array(secretKey) }
}

export function deriveSharedSecret(options: {
  privateKey: Uint8Array
  peerPublicKey: Uint8Array
}): Uint8Array {
  const { privateKey, peerPublicKey } = options

  // Validate key lengths and formats before deriving shared secret
  validateX25519Key(privateKey, 'private')
  validateX25519Key(peerPublicKey, 'public')

  try {
    const secret = x25519.getSharedSecret(privateKey, peerPublicKey)
    return new Uint8Array(secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    throw new X25519ValidationError(`Failed to derive shared secret: ${message}`)
  }
}

