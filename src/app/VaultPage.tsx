import { useCallback, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../ui/components/Button'
import { Panel } from '../ui/components/Panel'
import { Toast } from '../ui/components/Toast'
import { useWallet } from '../wallet/hooks/useWallet'
import { useVaultSession } from '../core/session/VaultSession'
import { detectMetaMask } from '../wallet/provider/detectMetaMask'
import { resetVault } from '../storage/db'

export function VaultPage() {
  const { isConnected, address, connect } = useWallet()
  const { session, buildChallenge, unlockFromSignature, lock } = useVaultSession()
  const [isSigning, setIsSigning] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()

  type LocationState = {
    from?: { pathname: string }
  }

  const handleUnlock = useCallback(async () => {
    if (!isConnected || !address) {
      await connect()
      return
    }

    const metaMask = detectMetaMask()
    if (!metaMask) {
      return
    }

    const challenge = buildChallenge(address)

    setIsSigning(true)
    try {
      const signature = (await metaMask.request({
        method: 'personal_sign',
        params: [challenge, address],
      })) as string

      await unlockFromSignature({ signature, address })

      const state = (location.state || {}) as LocationState
      const target = state.from?.pathname ?? '/chats'
      void navigate(target, { replace: true })
    } catch (err) {
      // Handle user rejection or other MetaMask errors gracefully
      const isUserRejection =
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err.code === 4001 || err.code === 'ACTION_REJECTED')
      if (!isUserRejection) {
        // Re-throw non-rejection errors so they surface in the UI
        throw err
      }
      // User rejected - silently return to locked state
    } finally {
      setIsSigning(false)
    }
  }, [address, buildChallenge, connect, isConnected, unlockFromSignature, location.state, navigate])

  const handleResetVault = useCallback(async () => {
    const confirmed = window.confirm(
      'This will permanently delete all local vault data. This action cannot be undone. Continue?',
    )
    if (!confirmed) return

    setIsResetting(true)
    try {
      await resetVault()
      lock()
      window.location.reload()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to reset vault. Please try again.'
      alert(message)
    } finally {
      setIsResetting(false)
    }
  }, [lock])

  const locked = session.status === 'locked'
  const unlocking = session.status === 'unlocking' || isSigning
  const unlocked = session.status === 'unlocked'
  const error = session.status === 'error' ? session.error : null

  return (
    <div className="flex min-h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 mb-4">
        <h1 className="text-lg font-semibold text-(--color-accent)">Vault Unlock</h1>
        <p className="text-xs text-fg-muted mt-1">
          Sign to derive session key
        </p>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pb-4">
        <Panel
          title="Unlock state"
          description="Session key lives only in memory."
        >
          <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
            {locked && <Toast>Vault is locked. Click unlock to begin.</Toast>}
            {unlocking && <Toast>Requesting wallet signature...</Toast>}
            {unlocked && (
              <Toast kind="success">
                Vault unlocked. Fingerprint:{' '}
                <code className="font-mono text-[10px]">{session.fingerprint}</code>
              </Toast>
            )}
            {error && <Toast kind="warning">{error}</Toast>}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleUnlock} disabled={unlocking}>
                {locked ? 'Unlock vault' : 'Re-unlock'}
              </Button>
              <Button variant="outline" onClick={lock} disabled={locked}>
                Lock
              </Button>
              <Button
                variant="outline"
                onClick={handleResetVault}
                disabled={isResetting || unlocking}
                className="text-rose-400"
              >
                {isResetting ? 'Resetting...' : 'Reset'}
              </Button>
            </div>
          </div>
        </Panel>

        <Panel
          title="Security notes"
          description="How the vault works."
        >
          <ul className="space-y-1.5 text-xs text-fg-muted max-h-[200px] overflow-y-auto pr-1">
            <li>• Challenge includes app name and version.</li>
            <li>• Session key derived from wallet signature.</li>
            <li>• Key never written to storage or network.</li>
            <li>• DSK encrypted before storage.</li>
            <li>• Reset wipes all local data.</li>
          </ul>
        </Panel>
      </div>
    </div>
  )
}
