import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../ui/components/Button'
import { Panel } from '../ui/components/Panel'
import { Toast } from '../ui/components/Toast'
import { useChain } from '../wallet/hooks/useChain'
import { useWallet } from '../wallet/hooks/useWallet'
import { mainnet } from 'viem/chains'
import { detectMetaMask } from '../wallet/provider/detectMetaMask'

type LocationState = {
  from?: { pathname: string }
}

export function WalletPage() {
  const wallet = useWallet()
  const chain = useChain()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!wallet.isConnected) return

    const state = (location.state || {}) as LocationState
    const target = state.from?.pathname ?? '/vault'

    void navigate(target, { replace: true })
  }, [wallet.isConnected, location.state, navigate])

  const handleSwitchToMainnet = async () => {
    const metaMask = detectMetaMask()
    if (!metaMask) {
      return
    }

    try {
      await metaMask.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${mainnet.id.toString(16)}` }],
      })
    } catch {
      // If the chain is not added or user rejects, we just leave the warning in place.
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-(--color-bg) text-fg px-4 py-6">
      <div className="w-full max-w-2xl space-y-4">
        <header className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-fg-soft">
            Retrochat
          </p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight text-fg">Wallet Connection</h1>
          <p className="mt-1 text-xs text-fg-muted">
            Connect your MetaMask wallet to access secure messaging.
          </p>
        </header>

        <Panel title="Connection Status" description="Connect or disconnect your MetaMask wallet.">
          {!wallet.isMetaMaskAvailable ? (
            <div className="space-y-2">
              <Toast kind="warning">
                MetaMask not detected. Please install MetaMask to connect your wallet.
              </Toast>
              <p className="text-xs text-fg-muted">
                Visit{' '}
                <a
                  href="https://metamask.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-fg"
                >
                  metamask.io
                </a>{' '}
                to install MetaMask.
              </p>
            </div>
          ) : wallet.isConnected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-(--color-bg-elevated) px-3 py-2">
                <span className="text-xs text-fg-soft">Address</span>
                <code className="text-xs font-mono text-fg">{wallet.address}</code>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-(--color-bg-elevated) px-3 py-2">
                <span className="text-xs text-fg-soft">Chain</span>
                <span className="text-xs text-fg">
                  {chain.chainName}
                  {!chain.isSupported && (
                    <span className="ml-2 text-fg-muted">(unsupported)</span>
                  )}
                </span>
              </div>
              {chain.isSupported ? (
                <Toast kind="success">Connected to supported network.</Toast>
              ) : (
                <div className="space-y-2">
                  <Toast kind="warning">
                    Connected to unsupported network. Please switch to Ethereum Mainnet.
                  </Toast>
                  <Button size="sm" variant="outline" onClick={handleSwitchToMainnet}>
                    Switch to Mainnet
                  </Button>
                </div>
              )}
              <Button variant="outline" onClick={wallet.disconnect} className="w-full">
                Disconnect
              </Button>
            </div>
          ) : wallet.isConnecting ? (
            <div className="space-y-2">
              <p className="text-xs text-fg-muted">Connecting to MetaMask...</p>
            </div>
          ) : wallet.isError ? (
            <div className="space-y-2">
              <Toast kind="warning">{wallet.error}</Toast>
              <Button onClick={wallet.connect} className="w-full">
                Retry Connection
              </Button>
            </div>
          ) : (
            <Button onClick={wallet.connect} className="w-full">
              Connect MetaMask
            </Button>
          )}
        </Panel>

        <Panel
          title="Security"
          description="Your wallet is used for authentication and encryption."
        >
          <ul className="space-y-1.5 text-xs text-fg-muted">
            <li>• Your wallet address is used as your identity</li>
            <li>• Messages are encrypted locally using your session key</li>
            <li>• Private keys never leave your wallet</li>
            <li>• No user gesture required to auto-reconnect</li>
          </ul>
        </Panel>
      </div>
    </main>
  )
}
