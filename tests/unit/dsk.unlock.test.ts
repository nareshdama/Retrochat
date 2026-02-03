import { describe, expect, it } from 'vitest'
import { generateDSK, encryptDSK, decryptDSK } from '../../src/crypto/dsk'
import { deriveSessionKeyMaterial, importSessionKey } from '../../src/crypto/unlock'

async function createSessionKeyFromSignature(signatureHex: string): Promise<CryptoKey> {
  const material = deriveSessionKeyMaterial(signatureHex)
  return importSessionKey(material)
}

describe('DSK unlock flow', () => {
  it('encrypts and decrypts DSK with a session key derived from a signature', async () => {
    const dsk = await generateDSK()
    const sessionKey = await createSessionKeyFromSignature('0x' + 'aa'.repeat(32))

    const encrypted = await encryptDSK({ dsk, sessionKey })
    const roundTripped = await decryptDSK({ encryptedDSK: encrypted, sessionKey })

    // Export both keys to raw form for stable equality check.
    const [origRaw, roundRaw] = await Promise.all([
      crypto.subtle.exportKey('raw', dsk),
      crypto.subtle.exportKey('raw', roundTripped),
    ])

    expect(new Uint8Array(origRaw)).toEqual(new Uint8Array(roundRaw))
  })

  it('fails to decrypt DSK with a different session key (wrong account)', async () => {
    const dsk = await generateDSK()
    const correctKey = await createSessionKeyFromSignature('0x' + 'bb'.repeat(32))
    const wrongKey = await createSessionKeyFromSignature('0x' + 'cc'.repeat(32))

    const encrypted = await encryptDSK({ dsk, sessionKey: correctKey })

    await expect(
      decryptDSK({
        encryptedDSK: encrypted,
        sessionKey: wrongKey,
      }),
    ).rejects.toThrow(/Wrong account or corrupted vault/i)
  })
})

