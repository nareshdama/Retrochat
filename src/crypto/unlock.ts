import { sha256 } from '@noble/hashes/sha2.js'
import { hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js'

const APP_CHALLENGE_ID = 'Retrochat Vault v1'
const KEY_DERIVATION_LABEL = 'retrochat:vault:session-key:v1'

export function buildUnlockChallenge(address: string): string {
  const normalized = address.toLowerCase()
  return `${APP_CHALLENGE_ID}::wallet=${normalized}`
}

export type SessionKeyMaterial = Uint8Array

export function deriveSessionKeyMaterial(signatureHex: string): SessionKeyMaterial {
  const clean = signatureHex.startsWith('0x') ? signatureHex.slice(2) : signatureHex
  const sigBytes = hexToBytes(clean)
  const labelBytes = utf8ToBytes(KEY_DERIVATION_LABEL)

  const input = new Uint8Array(labelBytes.length + sigBytes.length)
  input.set(labelBytes, 0)
  input.set(sigBytes, labelBytes.length)

  return sha256(input)
}

export async function importSessionKey(material: SessionKeyMaterial): Promise<CryptoKey> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto is not available in this environment.')
  }

  return crypto.subtle.importKey('raw', material as unknown as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

