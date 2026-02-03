import { randomBytes } from './random'

export type AeadCiphertext = {
  iv: Uint8Array
  ciphertext: Uint8Array
}

export async function importAeadKey(raw: Uint8Array): Promise<CryptoKey> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto is not available in this environment.')
  }

  const buffer = raw.buffer as ArrayBuffer

  return crypto.subtle.importKey('raw', buffer, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptAead(options: {
  key: CryptoKey
  plaintext: Uint8Array
  aad?: Uint8Array
}): Promise<AeadCiphertext> {
  const { key, plaintext, aad } = options

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto is not available in this environment.')
  }

  // 12-byte IV per NIST recommendation and WebCrypto default for GCM.
  const iv = randomBytes(12)

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      additionalData: aad as unknown as BufferSource | undefined,
    },
    key,
    plaintext as unknown as BufferSource,
  )

  return {
    iv,
    ciphertext: new Uint8Array(ciphertextBuffer),
  }
}

export async function decryptAead(options: {
  key: CryptoKey
  record: AeadCiphertext
  aad?: Uint8Array
}): Promise<Uint8Array> {
  const { key, record, aad } = options

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto is not available in this environment.')
  }

  try {
    const plaintextBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: record.iv as unknown as BufferSource,
        additionalData: aad as unknown as BufferSource | undefined,
      },
      key,
      record.ciphertext as unknown as BufferSource,
    )

    return new Uint8Array(plaintextBuffer)
  } catch (error) {
    // Authentication failure or invalid parameters.
    throw new Error('AEAD authentication failed')
  }
}

