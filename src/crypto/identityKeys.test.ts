import { describe, it, expect } from 'vitest'
import { toHex, fromHex, IdentityKeyError } from './identityKeys'

describe('identityKeys', () => {
  describe('toHex', () => {
    it('should convert Uint8Array to hex string', () => {
      const bytes = new Uint8Array([0, 1, 15, 16, 255])
      const hex = toHex(bytes)
      expect(hex).toBe('00010f10ff')
    })

    it('should handle empty array', () => {
      const bytes = new Uint8Array([])
      const hex = toHex(bytes)
      expect(hex).toBe('')
    })

    it('should handle single byte', () => {
      const bytes = new Uint8Array([0])
      const hex = toHex(bytes)
      expect(hex).toBe('00')
    })

    it('should throw for non-Uint8Array input', () => {
      expect(() => toHex('not-a-uint8array' as unknown as Uint8Array)).toThrow(IdentityKeyError)
    })
  })

  describe('fromHex', () => {
    it('should convert hex string to Uint8Array', () => {
      const hex = '00010f10ff'
      const bytes = fromHex(hex)
      expect(bytes).toEqual(new Uint8Array([0, 1, 15, 16, 255]))
    })

    it('should handle empty string', () => {
      const bytes = fromHex('')
      expect(bytes).toEqual(new Uint8Array([]))
    })

    it('should handle uppercase hex', () => {
      const hex = 'ABCDEF'
      const bytes = fromHex(hex)
      expect(bytes).toEqual(new Uint8Array([0xab, 0xcd, 0xef]))
    })

    it('should handle mixed case hex', () => {
      const hex = 'AbCdEf'
      const bytes = fromHex(hex)
      expect(bytes).toEqual(new Uint8Array([0xab, 0xcd, 0xef]))
    })

    it('should throw for odd-length string', () => {
      expect(() => fromHex('abc')).toThrow(IdentityKeyError)
    })

    it('should throw for non-hex characters', () => {
      expect(() => fromHex('xyz123')).toThrow(IdentityKeyError)
    })

    it('should throw for non-string input', () => {
      expect(() => fromHex(123 as unknown as string)).toThrow(IdentityKeyError)
    })

    it('should roundtrip correctly', () => {
      const original = new Uint8Array([0, 127, 128, 255])
      const hex = toHex(original)
      const roundtrip = fromHex(hex)
      expect(roundtrip).toEqual(original)
    })
  })
})
