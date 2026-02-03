import { describe, expect, it } from 'vitest'
import { hkdfSha256 } from './kdf'

describe('KDF Utilities', () => {
    it('derives consistent keys', async () => {
        const ikm = new TextEncoder().encode('input key material')
        const salt = new TextEncoder().encode('salt')
        const info = new TextEncoder().encode('info')
        const length = 32

        const key1 = await hkdfSha256({ ikm, salt, info, length })
        const key2 = await hkdfSha256({ ikm, salt, info, length })

        // Keys should be identical given same inputs
        expect(key1).toEqual(key2)
        expect(key1.byteLength).toBe(length)
    })

    it('generates different keys for different salts', async () => {
        const ikm = new TextEncoder().encode('input key material')
        const info = new TextEncoder().encode('info')
        const length = 32

        const key1 = await hkdfSha256({ ikm, salt: new TextEncoder().encode('salt1'), info, length })
        const key2 = await hkdfSha256({ ikm, salt: new TextEncoder().encode('salt2'), info, length })

        expect(key1).not.toEqual(key2)
    })
})
