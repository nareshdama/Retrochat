import { describe, expect, it } from 'vitest'
import { encryptAead, decryptAead } from './aead'

async function generateAesKey(): Promise<CryptoKey> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto is not available in this environment.')
  }

  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt'],
  )
}

describe('AEAD AES-GCM utilities', () => {
  it('roundtrips encrypt/decrypt with AAD', async () => {
    const key = await generateAesKey()
    const plaintext = new TextEncoder().encode('retrochat aead roundtrip')
    const aad = new TextEncoder().encode('retrochat:aad:v1')

    const ciphertext = await encryptAead({ key, plaintext, aad })
    const decrypted = await decryptAead({ key, record: ciphertext, aad })

    expect(new TextDecoder().decode(decrypted)).toBe('retrochat aead roundtrip')
    expect(ciphertext.iv.byteLength).toBe(12)
  })

  it('throws on tampered ciphertext', async () => {
    const key = await generateAesKey()
    const plaintext = new TextEncoder().encode('retrochat tamper detection')
    const aad = new TextEncoder().encode('retrochat:aad:v1')

    const ciphertext = await encryptAead({ key, plaintext, aad })
    // Flip a bit in the ciphertext to simulate tampering.
    ciphertext.ciphertext[0] ^= 0xff

    await expect(decryptAead({ key, record: ciphertext, aad })).rejects.toThrow(
      'AEAD authentication failed',
    )
  })
})

