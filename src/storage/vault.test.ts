import { beforeAll, describe, expect, it } from 'vitest'
import { getDb } from './db'
import { getDecryptedRecord, putEncryptedRecord } from './vault'

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

beforeAll(() => {
  if (typeof indexedDB === 'undefined') {
    // jsdom's IndexedDB is not always available; skip the suite in that case.
    // eslint-disable-next-line no-console
    console.warn('IndexedDB not available in test environment; skipping vault tests.')
  }
})

describe.skipIf(typeof indexedDB === 'undefined')('Encrypted vault storage', () => {
  it('writes and reads an encrypted record', async () => {
    const key = await generateAesKey()
    const payload = new TextEncoder().encode('hello encrypted vault')
    const aad = new TextEncoder().encode('retrochat:vault:aad')

    await putEncryptedRecord({
      store: 'keys',
      id: 'test-key-1',
      key,
      plaintext: payload,
      aad,
    })

    const roundtrip = await getDecryptedRecord({
      store: 'keys',
      id: 'test-key-1',
      key,
      aad,
    })

    expect(roundtrip).not.toBeNull()
    expect(new TextDecoder().decode(roundtrip!)).toBe('hello encrypted vault')

    const db = await getDb()
    const raw = await db.get('keys', 'test-key-1')
    expect(raw).not.toBeNull()
    expect(raw?.blob.ciphertext).instanceOf(Uint8Array)
    expect(raw?.blob.ciphertext.byteLength).toBeGreaterThan(0)
  })
})

