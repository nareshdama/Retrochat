import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useWallet } from '../wallet/hooks/useWallet'
import { useVaultSession } from '../core/session/VaultSession'

export function RequireVault() {
  const { isConnected } = useWallet()
  const { session } = useVaultSession()
  const location = useLocation()

  if (!isConnected) {
    return <Navigate to="/wallet" replace state={{ from: location }} />
  }

  if (session.status !== 'unlocked') {
    return <Navigate to="/vault" replace state={{ from: location }} />
  }

  return <Outlet />
}

