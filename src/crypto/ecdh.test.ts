import { describe, it, expect } from 'vitest'
import { generateX25519KeyPair, deriveSharedSecret, X25519ValidationError } from './ecdh'

describe('ecdh', () => {
  describe('generateX25519KeyPair', () => {
    it('should generate a valid key pair', () => {
      const keyPair = generateX25519KeyPair()
      
      expect(keyPair).toBeDefined()
      expect(keyPair.publicKey).toBeInstanceOf(Uint8Array)
      expect(keyPair.privateKey).toBeInstanceOf(Uint8Array)
      expect(keyPair.publicKey.length).toBe(32)
      expect(keyPair.privateKey.length).toBe(32)
    })

    it('should generate unique key pairs', () => {
      const keyPair1 = generateX25519KeyPair()
      const keyPair2 = generateX25519KeyPair()
      
      // Public keys should be different
      expect(keyPair1.publicKey).not.toEqual(keyPair2.publicKey)
      // Private keys should be different
      expect(keyPair1.privateKey).not.toEqual(keyPair2.privateKey)
    })

    it('should not generate all-zero keys', () => {
      const keyPair = generateX25519KeyPair()
      
      const publicKeyAllZero = keyPair.publicKey.every(b => b === 0)
      const privateKeyAllZero = keyPair.privateKey.every(b => b === 0)
      
      expect(publicKeyAllZero).toBe(false)
      expect(privateKeyAllZero).toBe(false)
    })
  })

  describe('deriveSharedSecret', () => {
    it('should derive the same shared secret for both parties', () => {
      const alice = generateX25519KeyPair()
      const bob = generateX25519KeyPair()
      
      const aliceShared = deriveSharedSecret({
        privateKey: alice.privateKey,
        peerPublicKey: bob.publicKey,
      })
      
      const bobShared = deriveSharedSecret({
        privateKey: bob.privateKey,
        peerPublicKey: alice.publicKey,
      })
      
      expect(aliceShared).toEqual(bobShared)
    })

    it('should return a 32-byte shared secret', () => {
      const alice = generateX25519KeyPair()
      const bob = generateX25519KeyPair()
      
      const shared = deriveSharedSecret({
        privateKey: alice.privateKey,
        peerPublicKey: bob.publicKey,
      })
      
      expect(shared).toBeInstanceOf(Uint8Array)
      expect(shared.length).toBe(32)
    })

    it('should throw for invalid private key length', () => {
      const bob = generateX25519KeyPair()
      const invalidPrivateKey = new Uint8Array(16) // Wrong length
      
      expect(() => {
        deriveSharedSecret({
          privateKey: invalidPrivateKey,
          peerPublicKey: bob.publicKey,
        })
      }).toThrow(X25519ValidationError)
    })

    it('should throw for invalid public key length', () => {
      const alice = generateX25519KeyPair()
      const invalidPublicKey = new Uint8Array(16) // Wrong length
      
      expect(() => {
        deriveSharedSecret({
          privateKey: alice.privateKey,
          peerPublicKey: invalidPublicKey,
        })
      }).toThrow(X25519ValidationError)
    })

    it('should throw for all-zero private key', () => {
      const bob = generateX25519KeyPair()
      const zeroPrivateKey = new Uint8Array(32) // All zeros
      
      expect(() => {
        deriveSharedSecret({
          privateKey: zeroPrivateKey,
          peerPublicKey: bob.publicKey,
        })
      }).toThrow(X25519ValidationError)
    })

    it('should throw for all-zero public key', () => {
      const alice = generateX25519KeyPair()
      const zeroPublicKey = new Uint8Array(32) // All zeros
      
      expect(() => {
        deriveSharedSecret({
          privateKey: alice.privateKey,
          peerPublicKey: zeroPublicKey,
        })
      }).toThrow(X25519ValidationError)
    })

    it('should throw for non-Uint8Array private key', () => {
      const bob = generateX25519KeyPair()
      
      expect(() => {
        deriveSharedSecret({
          privateKey: 'not-a-uint8array' as unknown as Uint8Array,
          peerPublicKey: bob.publicKey,
        })
      }).toThrow(X25519ValidationError)
    })
  })
})
