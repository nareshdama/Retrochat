import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { createWalletClient, custom, getAddress, type Chain } from 'viem'
import { mainnet, sepolia, polygon, arbitrum, optimism } from 'viem/chains'
import { detectMetaMask, getMetaMaskError, type MetaMaskProvider } from './detectMetaMask'
import {
  WalletContext,
  type WalletContextValue,
  type WalletStatus,
} from '../../core/state/WalletState'

// Supported chains mapping
const SUPPORTED_CHAINS: Record<number, Chain> = {
  [mainnet.id]: mainnet,
  [sepolia.id]: sepolia,
  [polygon.id]: polygon,
  [arbitrum.id]: arbitrum,
  [optimism.id]: optimism,
}

function normalizeAddress(address: string): string {
  try {
    return getAddress(address)
  } catch {
    // Log invalid address for debugging but return original to avoid breaking flow
    console.warn('Invalid address format received:', address)
    return address
  }
}

function parseChainId(chainIdValue: unknown): number | null {
  if (typeof chainIdValue === 'string') {
    // Handle hex format (0x...)
    const parsed = chainIdValue.startsWith('0x')
      ? Number.parseInt(chainIdValue, 16)
      : Number.parseInt(chainIdValue, 10)
    return Number.isNaN(parsed) ? null : parsed
  }
  if (typeof chainIdValue === 'number') {
    return Number.isNaN(chainIdValue) ? null : chainIdValue
  }
  return null
}

async function getChainId(metaMask: MetaMaskProvider): Promise<number> {
  try {
    const chainIdRaw = await metaMask.request({ method: 'eth_chainId' })
    const chainId = parseChainId(chainIdRaw)
    if (chainId === null) {
      console.warn('Failed to parse chain ID, defaulting to mainnet')
      return mainnet.id
    }
    return chainId
  } catch (err) {
    console.error('Failed to get chain ID:', err)
    return mainnet.id
  }
}

function getChainForId(chainId: number): Chain {
  return SUPPORTED_CHAINS[chainId] || mainnet
}

export function WalletProvider({ children }: { children: ReactNode }) {
  // Security default: do not persist wallet state in localStorage/sessionStorage.
  // Wallet connection should always be an explicit user gesture.
  const [wallet, setWallet] = useState<WalletStatus>({ status: 'disconnected' })
  // Use ref to store current wallet status to avoid stale closures in event handlers
  const walletRef = useRef(wallet)
  walletRef.current = wallet

  const isMetaMaskAvailable = typeof window !== 'undefined' && !!detectMetaMask()

  const handleAccountsChanged = useCallback(async (accounts: unknown[]) => {
    const metaMask = detectMetaMask()
    const accountList = Array.isArray(accounts) ? accounts : []
    if (accountList.length === 0) {
      setWallet({ status: 'disconnected' })
    } else if (metaMask) {
      const address = normalizeAddress(String(accountList[0]))
      const chainId = await getChainId(metaMask)

      setWallet({
        status: 'connected',
        address,
        chainId,
      })
    }
  }, [])

  const handleChainChanged = useCallback((chainId: unknown) => {
    const parsed = parseChainId(chainId)
    if (parsed === null) {
      console.warn('Received invalid chain ID from wallet:', chainId)
      return
    }

    // Use ref to get current wallet status to avoid stale closure
    const currentWallet = walletRef.current
    if (currentWallet.status === 'connected') {
      setWallet({
        ...currentWallet,
        chainId: parsed,
      })
    }
  }, [])

  useEffect(() => {
    const metaMask = detectMetaMask()
    if (!metaMask) return

    metaMask.on('accountsChanged', handleAccountsChanged)
    metaMask.on('chainChanged', handleChainChanged)

    // Sync with MetaMask's current accounts on load (eth_accounts does not prompt).
    // Wrap in try-catch to handle potential provider errors
    metaMask
      .request({ method: 'eth_accounts' })
      .then((accounts: unknown) => handleAccountsChanged(Array.isArray(accounts) ? accounts : []))
      .catch((err) => {
        console.error('Failed to get initial accounts:', err)
        // Don't set error state here - user hasn't explicitly tried to connect yet
      })

    return () => {
      metaMask.removeListener('accountsChanged', handleAccountsChanged)
      metaMask.removeListener('chainChanged', handleChainChanged)
    }
  }, [handleAccountsChanged, handleChainChanged])

  const connect = async (): Promise<void> => {
    const metaMask = detectMetaMask()

    if (!metaMask) {
      const error = getMetaMaskError()
      setWallet({ status: 'error', error: error.message })
      return
    }

    setWallet({ status: 'connecting' })

    try {
      const accounts = (await metaMask.request({
        method: 'eth_requestAccounts',
      })) as string[]

      if (!accounts || accounts.length === 0) {
        setWallet({ status: 'error', error: 'No accounts found. Please unlock your wallet.' })
        return
      }

      const address = normalizeAddress(accounts[0])
      const chainId = await getChainId(metaMask)

      setWallet({
        status: 'connected',
        address,
        chainId,
      })
    } catch (error) {
      // Handle specific wallet errors
      const walletError = error as { code?: number; message?: string }
      let message: string

      if (walletError.code === 4001) {
        // User rejected the request
        message = 'Connection request was rejected. Please try again.'
      } else if (walletError.code === -32002) {
        // Request already pending
        message = 'A connection request is already pending. Please check your wallet.'
      } else {
        message = walletError.message || 'Failed to connect wallet. Please try again.'
      }

      setWallet({ status: 'error', error: message })
    }
  }

  const disconnect = (): void => {
    setWallet({ status: 'disconnected' })
  }

  const value: WalletContextValue = {
    wallet,
    connect,
    disconnect,
    isMetaMaskAvailable,
  }

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

/**
 * Creates a wallet client for the current provider with the correct chain.
 * 
 * @param chainId - The chain ID to use. If not provided, defaults to mainnet.
 * @returns A wallet client or null if no provider is available.
 */
export function createWalletClientFromProvider(chainId?: number): ReturnType<typeof createWalletClient> | null {
  const metaMask = detectMetaMask()
  if (!metaMask) return null

  // Use the provided chainId or default to mainnet
  const chain = chainId ? getChainForId(chainId) : mainnet

  return createWalletClient({
    chain,
    transport: custom(metaMask),
  })
}

/**
 * Creates a wallet client using the current chain from the wallet state.
 * Should be called when you have access to the wallet context.
 * 
 * @param wallet - The current wallet status from context
 * @returns A wallet client or null if wallet is not connected
 */
export function createWalletClientForCurrentChain(
  wallet: WalletStatus
): ReturnType<typeof createWalletClient> | null {
  if (wallet.status !== 'connected') {
    return null
  }
  return createWalletClientFromProvider(wallet.chainId)
}
