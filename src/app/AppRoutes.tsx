import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ShellLayout } from '../ui/ShellLayout'
import { HealthView } from './HealthView'
import { WalletPage } from './WalletPage'
import { VaultPage } from './VaultPage'
import { RequireVault } from './RequireVault'

// Lazy load feature pages for code splitting
const ChatPage = lazy(() => import('../features/ChatPage').then(module => ({ default: module.ChatPage })))
const ContactsPage = lazy(() => import('../features/ContactsPage').then(module => ({ default: module.ContactsPage })))
const SettingsPage = lazy(() => import('../features/SettingsPage').then(module => ({ default: module.SettingsPage })))

// Loading component
const PageLoader = () => (
  <div className="flex h-full items-center justify-center p-8">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--color-accent) border-t-transparent" />
  </div>
)

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/health" element={<HealthView status={{ app: 'ok', env: 'valid' }} />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/vault" element={<VaultPage />} />

        <Route path="/" element={<ShellLayout />}>
          <Route index element={<Navigate to="/chats" replace />} />

          <Route element={<RequireVault />}>
            <Route path="chats" element={<ChatPage />} />
            <Route path="chats/:conversationId" element={<ChatPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

