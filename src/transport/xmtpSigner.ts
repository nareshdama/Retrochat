import type { Signer } from '@xmtp/xmtp-js'
import type { MetaMaskProvider } from '../wallet/provider/detectMetaMask'
import { getAddress } from 'viem'

export function createMetaMaskSigner(
  provider: MetaMaskProvider,
  address: string,
): Signer {
  const normalizedAddress = getAddress(address)

  return {
    getAddress: async () => normalizedAddress,
    signMessage: async (message: Uint8Array) => {
      const hexMessage = `0x${Array.from(message)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}`

      const signature = (await provider.request({
        method: 'personal_sign',
        params: [hexMessage, normalizedAddress],
      })) as string

      // XMTP expects hex string signature (with or without 0x prefix)
      return signature
    },
  }
}
