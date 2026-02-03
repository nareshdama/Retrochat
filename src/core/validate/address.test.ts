import { describe, it, expect } from 'vitest'
import { parseAddress, safeParseAddress } from './address'

describe('address validation', () => {
  const validAddress = '0x1234567890123456789012345678901234567890'
  const checksummedAddress = '0x1234567890123456789012345678901234567890'

  describe('parseAddress', () => {
    it('should parse a valid lowercase address', () => {
      const result = parseAddress(validAddress.toLowerCase())
      expect(result).toBe(checksummedAddress)
    })

    it('should parse a valid uppercase address', () => {
      const result = parseAddress(validAddress.toUpperCase().replace('0X', '0x'))
      expect(result).toBe(checksummedAddress)
    })

    it('should trim whitespace from address', () => {
      const result = parseAddress(`  ${validAddress}  `)
      expect(result).toBe(checksummedAddress)
    })

    it('should throw for an invalid address', () => {
      expect(() => parseAddress('not-an-address')).toThrow()
    })

    it('should throw for an address without 0x prefix', () => {
      expect(() => parseAddress('1234567890123456789012345678901234567890')).toThrow()
    })

    it('should throw for an address with wrong length', () => {
      expect(() => parseAddress('0x12345678901234567890')).toThrow()
    })

    it('should throw for non-string input', () => {
      expect(() => parseAddress(123)).toThrow()
      expect(() => parseAddress(null)).toThrow()
      expect(() => parseAddress(undefined)).toThrow()
    })

    it('should throw for empty string', () => {
      expect(() => parseAddress('')).toThrow()
    })
  })

  describe('safeParseAddress', () => {
    it('should return ok: true for valid address', () => {
      const result = safeParseAddress(validAddress)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe(checksummedAddress)
      }
    })

    it('should return ok: false for invalid address', () => {
      const result = safeParseAddress('invalid')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe('Invalid wallet address.')
      }
    })

    it('should return ok: false for non-string input', () => {
      const result = safeParseAddress(123)
      expect(result.ok).toBe(false)
    })

    it('should return ok: false for null', () => {
      const result = safeParseAddress(null)
      expect(result.ok).toBe(false)
    })

    it('should return ok: false for undefined', () => {
      const result = safeParseAddress(undefined)
      expect(result.ok).toBe(false)
    })
  })
})
