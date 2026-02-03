import { getDb } from './db'
import { decryptDSK, encryptDSK, generateDSK } from '../crypto/dsk'

const DSK_ID = 'dsk'

export async function getOrCreateDSK(sessionKey: CryptoKey): Promise<CryptoKey> {
  const db = await getDb()
  const existing = await db.get('keys', DSK_ID)

  if (existing) {
    try {
      return decryptDSK({
        encryptedDSK: existing.blob,
        sessionKey,
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('Wrong account')) {
        throw error
      }
      throw new Error('Failed to decrypt DSK. The vault may be corrupted.')
    }
  }

  // No DSK exists; generate and persist encrypted form.
  const dsk = await generateDSK()
  const encryptedDSK = await encryptDSK({ dsk, sessionKey })

  const now = new Date().toISOString()
  await db.put('keys', {
    id: DSK_ID,
    blob: encryptedDSK,
    createdAt: now,
    updatedAt: now,
  })

  return dsk
}

export async function getDSK(sessionKey: CryptoKey): Promise<CryptoKey | null> {
  const db = await getDb()
  const existing = await db.get('keys', DSK_ID)

  if (!existing) {
    return null
  }

  try {
    return decryptDSK({
      encryptedDSK: existing.blob,
      sessionKey,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Wrong account')) {
      throw error
    }
    throw new Error('Failed to decrypt DSK. The vault may be corrupted.')
  }
}
