import { describe, it, expect } from 'vitest'
import { safeParseMessageEnvelope, HexSchema } from './message'

describe('message validation', () => {
  const validEnvelope = {
    v: 1,
    from: '0x1234567890123456789012345678901234567890',
    to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    ts: '2024-01-01T00:00:00.000Z',
    nonce: '12345678901234567890123456789012', // 32 hex chars = 16 bytes
    iv: '123456789012345678901234', // 24 hex chars = 12 bytes
    ciphertext: 'abcdef1234567890', // any valid hex
  }

  describe('HexSchema', () => {
    it('should accept valid hex strings', () => {
      const result = HexSchema.safeParse('abcdef1234567890')
      expect(result.success).toBe(true)
    })

    it('should accept uppercase hex strings', () => {
      const result = HexSchema.safeParse('ABCDEF1234567890')
      expect(result.success).toBe(true)
    })

    it('should reject odd-length hex strings', () => {
      const result = HexSchema.safeParse('abc')
      expect(result.success).toBe(false)
    })

    it('should reject non-hex characters', () => {
      const result = HexSchema.safeParse('xyz123')
      expect(result.success).toBe(false)
    })

    it('should reject empty string (requires at least one hex char)', () => {
      // HexSchema uses regex that requires at least one character
      const result = HexSchema.safeParse('')
      expect(result.success).toBe(false)
    })
  })

  describe('safeParseMessageEnvelope', () => {
    it('should parse a valid message envelope', () => {
      const result = safeParseMessageEnvelope(validEnvelope)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.v).toBe(1)
        expect(result.value.from).toBe(validEnvelope.from)
        expect(result.value.to).toBe(validEnvelope.to)
      }
    })

    it('should accept envelope with optional aad', () => {
      const envelopeWithAad = { ...validEnvelope, aad: 'deadbeef' }
      const result = safeParseMessageEnvelope(envelopeWithAad)
      expect(result.ok).toBe(true)
    })

    it('should reject invalid version', () => {
      const invalidEnvelope = { ...validEnvelope, v: 2 }
      const result = safeParseMessageEnvelope(invalidEnvelope)
      expect(result.ok).toBe(false)
    })

    it('should reject version 0', () => {
      const invalidEnvelope = { ...validEnvelope, v: 0 }
      const result = safeParseMessageEnvelope(invalidEnvelope)
      expect(result.ok).toBe(false)
    })

    it('should reject invalid from address', () => {
      const invalidEnvelope = { ...validEnvelope, from: 'not-an-address' }
      const result = safeParseMessageEnvelope(invalidEnvelope)
      expect(result.ok).toBe(false)
    })

    it('should reject invalid to address', () => {
      const invalidEnvelope = { ...validEnvelope, to: 'not-an-address' }
      const result = safeParseMessageEnvelope(invalidEnvelope)
      expect(result.ok).toBe(false)
    })

    it('should reject invalid timestamp format', () => {
      const invalidEnvelope = { ...validEnvelope, ts: 'not-a-date' }
      const result = safeParseMessageEnvelope(invalidEnvelope)
      expect(result.ok).toBe(false)
    })

    it('should reject invalid nonce length', () => {
      const invalidEnvelope = { ...validEnvelope, nonce: 'abcd' } // too short
      const result = safeParseMessageEnvelope(invalidEnvelope)
      expect(result.ok).toBe(false)
    })

    it('should reject invalid iv length', () => {
      const invalidEnvelope = { ...validEnvelope, iv: 'abcd' } // too short
      const result = safeParseMessageEnvelope(invalidEnvelope)
      expect(result.ok).toBe(false)
    })

    it('should reject empty ciphertext', () => {
      const invalidEnvelope = { ...validEnvelope, ciphertext: '' }
      const result = safeParseMessageEnvelope(invalidEnvelope)
      expect(result.ok).toBe(false)
    })

    it('should reject non-hex nonce', () => {
      const invalidEnvelope = { ...validEnvelope, nonce: 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz' }
      const result = safeParseMessageEnvelope(invalidEnvelope)
      expect(result.ok).toBe(false)
    })

    it('should reject missing required fields', () => {
      const incomplete = { v: 1, from: validEnvelope.from }
      const result = safeParseMessageEnvelope(incomplete)
      expect(result.ok).toBe(false)
    })

    it('should reject null input', () => {
      const result = safeParseMessageEnvelope(null)
      expect(result.ok).toBe(false)
    })

    it('should reject undefined input', () => {
      const result = safeParseMessageEnvelope(undefined)
      expect(result.ok).toBe(false)
    })

    it('should reject non-object input', () => {
      const result = safeParseMessageEnvelope('string')
      expect(result.ok).toBe(false)
    })
  })
})
