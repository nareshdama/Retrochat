import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Buffer } from 'buffer'
import './index.css'
import { AppShell } from './app/AppShell'
import { initPwa } from './app/pwa/registerPwa'
import { AppErrorBoundary } from './app/errors/AppErrorBoundary'
import { WalletProvider } from './wallet'
import { VaultSessionProvider } from './core/session/VaultSession'

// Polyfill Node's global Buffer for XMTP/browser compatibility.
if (!(globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer) {
  ; (globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer = Buffer
}

initPwa()

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <VaultSessionProvider>
          <AppErrorBoundary>
            <AppShell />
          </AppErrorBoundary>
        </VaultSessionProvider>
      </WalletProvider>
    </BrowserRouter>
  </StrictMode>,
)
