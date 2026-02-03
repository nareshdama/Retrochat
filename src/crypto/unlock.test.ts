import { describe, it, expect } from 'vitest'
import { buildUnlockChallenge, deriveSessionKeyMaterial } from './unlock'

describe('unlock', () => {
  describe('buildUnlockChallenge', () => {
    const testAddress = '0x1234567890123456789012345678901234567890'

    it('should build a challenge string containing the address', () => {
      const challenge = buildUnlockChallenge(testAddress)
      expect(challenge).toContain('wallet=')
      expect(challenge).toContain(testAddress.toLowerCase())
    })

    it('should normalize address to lowercase', () => {
      const upperAddress = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12'
      const challenge = buildUnlockChallenge(upperAddress)
      expect(challenge).toContain(upperAddress.toLowerCase())
    })

    it('should include app identifier', () => {
      const challenge = buildUnlockChallenge(testAddress)
      expect(challenge).toContain('Retrochat')
    })

    it('should produce consistent challenges for same address', () => {
      const challenge1 = buildUnlockChallenge(testAddress)
      const challenge2 = buildUnlockChallenge(testAddress)
      expect(challenge1).toBe(challenge2)
    })

    it('should produce different challenges for different addresses', () => {
      const address1 = '0x1234567890123456789012345678901234567890'
      const address2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
      const challenge1 = buildUnlockChallenge(address1)
      const challenge2 = buildUnlockChallenge(address2)
      expect(challenge1).not.toBe(challenge2)
    })
  })

  describe('deriveSessionKeyMaterial', () => {
    const validSignature = '0x' + 'ab'.repeat(65) // 65 bytes for ECDSA signature

    it('should derive key material from signature', () => {
      const material = deriveSessionKeyMaterial(validSignature)
      expect(material).toBeInstanceOf(Uint8Array)
      expect(material.length).toBe(32) // SHA-256 output
    })

    it('should handle signature without 0x prefix', () => {
      const signatureWithoutPrefix = 'ab'.repeat(65)
      const material = deriveSessionKeyMaterial(signatureWithoutPrefix)
      expect(material).toBeInstanceOf(Uint8Array)
      expect(material.length).toBe(32)
    })

    it('should produce consistent output for same signature', () => {
      const material1 = deriveSessionKeyMaterial(validSignature)
      const material2 = deriveSessionKeyMaterial(validSignature)
      expect(material1).toEqual(material2)
    })

    it('should produce different output for different signatures', () => {
      const signature1 = '0x' + 'ab'.repeat(65)
      const signature2 = '0x' + 'cd'.repeat(65)
      const material1 = deriveSessionKeyMaterial(signature1)
      const material2 = deriveSessionKeyMaterial(signature2)
      expect(material1).not.toEqual(material2)
    })

    it('should handle short signatures', () => {
      const shortSignature = '0xabcd'
      const material = deriveSessionKeyMaterial(shortSignature)
      expect(material).toBeInstanceOf(Uint8Array)
      expect(material.length).toBe(32)
    })
  })
})
