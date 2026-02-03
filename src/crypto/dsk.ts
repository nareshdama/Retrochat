import { encryptAead, decryptAead, type AeadCiphertext } from './aead'

const DSK_AAD_LABEL = new TextEncoder().encode('retrochat:dsk:v1')

export async function generateDSK(): Promise<CryptoKey> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto is not available in this environment.')
  }

  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    // Mark DSK as extractable so it can be wrapped (encrypted)
    // and stored in the vault via exportKey + encryptAead.
    // The exported bytes are always protected by AEAD before persistence.
    true,
    ['encrypt', 'decrypt'],
  )
}

export async function exportDSK(key: CryptoKey): Promise<Uint8Array> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto is not available in this environment.')
  }

  const raw = await crypto.subtle.exportKey('raw', key)
  return new Uint8Array(raw)
}

export async function importDSK(raw: Uint8Array): Promise<CryptoKey> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto is not available in this environment.')
  }

  return crypto.subtle.importKey('raw', raw as unknown as BufferSource, 'AES-GCM', true, ['encrypt', 'decrypt'])
}

export async function encryptDSK(options: {
  dsk: CryptoKey
  sessionKey: CryptoKey
}): Promise<AeadCiphertext> {
  const { dsk, sessionKey } = options

  const dskRaw = await exportDSK(dsk)

  return encryptAead({
    key: sessionKey,
    plaintext: dskRaw,
    aad: DSK_AAD_LABEL,
  })
}

export async function decryptDSK(options: {
  encryptedDSK: AeadCiphertext
  sessionKey: CryptoKey
}): Promise<CryptoKey> {
  const { encryptedDSK, sessionKey } = options

  try {
    const dskRaw = await decryptAead({
      key: sessionKey,
      record: encryptedDSK,
      aad: DSK_AAD_LABEL,
    })

    return importDSK(dskRaw)
  } catch (error) {
    if (error instanceof Error && error.message === 'AEAD authentication failed') {
      throw new Error('Wrong account or corrupted vault. Please reset the vault.')
    }
    throw error
  }
}
