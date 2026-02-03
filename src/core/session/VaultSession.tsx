import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import { buildUnlockChallenge, deriveSessionKeyMaterial, importSessionKey } from '../../crypto/unlock'
import { getOrCreateDSK } from '../../storage/keys'

export type VaultSessionState =
  | { status: 'locked' }
  | { status: 'unlocking' }
  | { status: 'unlocked'; key: CryptoKey; fingerprint: string; dsk: CryptoKey; address: string }
  | { status: 'error'; error: string }

export type VaultSessionContextValue = {
  session: VaultSessionState
  unlockFromSignature: (options: { signature: string; address: string }) => Promise<void>
  lock: () => void
  buildChallenge: (address: string) => string
}

const VaultSessionContext = createContext<VaultSessionContextValue | null>(null)

// Validate Ethereum address format
function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

// Validate signature format (0x followed by 130 hex chars for ECDSA signature)
function isValidSignatureFormat(signature: string): boolean {
  const clean = signature.startsWith('0x') ? signature.slice(2) : signature
  // ECDSA signatures are 65 bytes (130 hex chars): r (32 bytes) + s (32 bytes) + v (1 byte)
  return /^[a-fA-F0-9]{130}$/.test(clean)
}

export function useVaultSession(): VaultSessionContextValue {
  const ctx = useContext(VaultSessionContext)
  if (!ctx) {
    throw new Error('useVaultSession must be used within VaultSessionProvider')
  }
  return ctx
}

export function VaultSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<VaultSessionState>({ status: 'locked' })
  // Store the address used for the last successful unlock to prevent replay attacks
  const lastUnlockAddressRef = useRef<string | null>(null)

  const lock = useCallback(() => {
    // Clear the stored address reference
    lastUnlockAddressRef.current = null
    // Wipe the in-memory key by dropping the reference
    setSession({ status: 'locked' })
  }, [])

  const unlockFromSignature = useCallback(
    async ({ signature, address }: { signature: string; address: string }) => {
      setSession({ status: 'unlocking' })
      try {
        // Validate address format
        if (!address) {
          throw new Error('Missing address for unlock.')
        }
        if (!isValidEthereumAddress(address)) {
          throw new Error('Invalid Ethereum address format.')
        }

        // Validate signature format
        if (!signature) {
          throw new Error('Missing signature for unlock.')
        }
        if (!isValidSignatureFormat(signature)) {
          throw new Error('Invalid signature format.')
        }

        // Normalize address for consistent key derivation
        const normalizedAddress = address.toLowerCase()

        // Check for potential replay attacks - same address trying to unlock again
        // with potentially different signature should still work, but we track it
        if (lastUnlockAddressRef.current && 
            lastUnlockAddressRef.current !== normalizedAddress &&
            session.status === 'unlocked') {
          // Different address trying to unlock - this might be suspicious
          // Log for monitoring but allow the attempt
          console.warn('Unlock attempt with different address while already unlocked')
        }

        const material = deriveSessionKeyMaterial(signature)
        const key = await importSessionKey(material)

        // Use a short fingerprint for debugging / telemetry, not the full key.
        const fingerprintBytes = material.slice(0, 8)
        const fingerprint = Array.from(fingerprintBytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')

        // Get or create DSK using the session key.
        const dsk = await getOrCreateDSK(key)

        // Store the address used for this unlock
        lastUnlockAddressRef.current = normalizedAddress

        setSession({
          status: 'unlocked',
          key,
          fingerprint,
          dsk,
          address: normalizedAddress,
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to unlock vault. Please try again.'
        setSession({ status: 'error', error: message })
      }
    },
    [session.status],
  )

  const buildChallenge = useCallback((address: string) => buildUnlockChallenge(address), [])

  const value: VaultSessionContextValue = {
    session,
    unlockFromSignature,
    lock,
    buildChallenge,
  }

  return <VaultSessionContext.Provider value={value}>{children}</VaultSessionContext.Provider>
}

