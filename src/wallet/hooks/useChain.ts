import { mainnet, sepolia, type Chain } from 'viem/chains'
import { useWallet } from './useWallet'

const SUPPORTED_CHAINS: Record<number, Chain> = {
  [mainnet.id]: mainnet,
  [sepolia.id]: sepolia,
}

export function useChain() {
  const { chainId } = useWallet()

  if (!chainId) {
    return {
      chain: null,
      isSupported: false,
      chainName: null,
    }
  }

  const chain = SUPPORTED_CHAINS[chainId] ?? null
  const isSupported = chain !== null

  return {
    chain,
    isSupported,
    chainName: chain?.name ?? `Chain ${chainId}`,
  }
}
