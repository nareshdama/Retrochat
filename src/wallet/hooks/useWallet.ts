import { useWalletContext } from '../../core/state/WalletState'

export function useWallet() {
  const { wallet, connect, disconnect, isMetaMaskAvailable } = useWalletContext()

  return {
    wallet,
    connect,
    disconnect,
    isMetaMaskAvailable,
    isConnected: wallet.status === 'connected',
    isConnecting: wallet.status === 'connecting',
    isError: wallet.status === 'error',
    address: wallet.status === 'connected' ? wallet.address : undefined,
    chainId: wallet.status === 'connected' ? wallet.chainId : undefined,
    error: wallet.status === 'error' ? wallet.error : undefined,
  }
}
