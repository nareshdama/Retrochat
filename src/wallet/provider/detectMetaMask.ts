import type { EIP1193Provider } from 'viem'

export type MetaMaskProvider = EIP1193Provider & {
  isMetaMask?: boolean
  _metamask?: {
    isUnlocked?: () => Promise<boolean>
  }
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  on: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener: (event: string, handler: (...args: unknown[]) => void) => void
}

/**
 * Validates that the provider implements required EIP-1193 methods.
 * This helps detect malicious or incomplete provider implementations.
 */
function validateProviderInterface(provider: unknown): provider is MetaMaskProvider {
  if (!provider || typeof provider !== 'object') {
    return false
  }

  const p = provider as Record<string, unknown>

  // Must have request method
  if (typeof p.request !== 'function') {
    return false
  }

  // Must have event handling methods
  if (typeof p.on !== 'function' || typeof p.removeListener !== 'function') {
    return false
  }

  return true
}

/**
 * Detects and validates a wallet provider (MetaMask or compatible).
 * 
 * Security considerations:
 * - Validates the provider implements required EIP-1193 interface
 * - Prefers providers with explicit isMetaMask flag
 * - Logs warnings for unverified providers
 * 
 * @param options.requireMetaMask - If true, only accept providers with isMetaMask flag
 * @returns The validated provider or null if none found/valid
 */
export function detectMetaMask(options?: { requireMetaMask?: boolean }): MetaMaskProvider | null {
  const { requireMetaMask = false } = options || {}

  if (typeof window === 'undefined') return null

  const ethereum = (window as typeof window & { ethereum?: unknown }).ethereum

  if (!ethereum) return null

  // Validate the provider implements the required interface
  if (!validateProviderInterface(ethereum)) {
    console.warn('Wallet provider found but does not implement required EIP-1193 interface')
    return null
  }

  // Check if it's MetaMask specifically
  if (ethereum.isMetaMask === true) {
    // Additional verification: MetaMask exposes _metamask object
    if (ethereum._metamask && typeof ethereum._metamask.isUnlocked === 'function') {
      return ethereum
    }
    // isMetaMask is true but missing _metamask - could be a spoofed provider
    // Still allow but log a warning
    console.warn('Provider claims to be MetaMask but missing _metamask API - exercise caution')
    return ethereum
  }

  // Provider exists but isn't explicitly MetaMask
  if (requireMetaMask) {
    console.warn('Wallet provider found but is not MetaMask. Set requireMetaMask=false to allow other wallets.')
    return null
  }

  // Allow other EIP-1193 compatible wallets with a warning
  console.info('Using non-MetaMask wallet provider. Ensure you trust this wallet extension.')
  return ethereum
}

export type WalletProviderError = {
  code: 'NOT_BROWSER' | 'NOT_INSTALLED' | 'INVALID_PROVIDER' | 'CONNECTION_FAILED'
  message: string
}

export function getMetaMaskError(): WalletProviderError {
  if (typeof window === 'undefined') {
    return {
      code: 'NOT_BROWSER',
      message: 'Wallet connection is only available in the browser.',
    }
  }

  const ethereum = (window as typeof window & { ethereum?: unknown }).ethereum

  if (!ethereum) {
    return {
      code: 'NOT_INSTALLED',
      message: 'MetaMask is not installed. Please install MetaMask to connect your wallet.',
    }
  }

  if (!validateProviderInterface(ethereum)) {
    return {
      code: 'INVALID_PROVIDER',
      message: 'The wallet provider does not implement the required interface. Please use a compatible wallet.',
    }
  }

  return {
    code: 'CONNECTION_FAILED',
    message: 'Unable to connect to wallet. Please check your wallet settings and try again.',
  }
}
