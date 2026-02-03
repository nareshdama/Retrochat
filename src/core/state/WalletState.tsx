import { createContext, useContext } from 'react'

export type WalletStatus =
  | { status: 'disconnected' }
  | { status: 'connecting' }
  | { status: 'connected'; address: string; chainId: number }
  | { status: 'error'; error: string }

export type WalletContextValue = {
  wallet: WalletStatus
  connect: () => Promise<void>
  disconnect: () => void
  isMetaMaskAvailable: boolean
}

export const WalletContext = createContext<WalletContextValue | null>(null)

export function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) {
    throw new Error('useWalletContext must be used within WalletProvider')
  }
  return ctx
}
