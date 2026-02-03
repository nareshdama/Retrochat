import { NavLink, Outlet, useLocation } from 'react-router-dom'

// Modern SF Symbols / Material Icons style SVGs
const ChatIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
  </svg>
)

const ContactsIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </svg>
)

const SettingsIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
)

// Decentralized Network Logo - interconnected nodes with chat bubble
const DecentralizedLogo = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    {/* Three interconnected nodes forming a mesh network */}
    <circle cx="12" cy="6" r="2" fill="currentColor" />
    <circle cx="6" cy="16" r="2" fill="currentColor" />
    <circle cx="18" cy="16" r="2" fill="currentColor" />
    {/* Connection lines between nodes */}
    <line x1="12" y1="8" x2="7" y2="14.5" strokeLinecap="round" />
    <line x1="12" y1="8" x2="17" y2="14.5" strokeLinecap="round" />
    <line x1="8" y1="16" x2="16" y2="16" strokeLinecap="round" />
    {/* Chat bubble outline around the network */}
    <path d="M12 2C6.48 2 2 5.58 2 10c0 2.24 1.12 4.24 2.88 5.62L4 21l4.5-2.25C9.6 18.92 10.78 19 12 19c5.52 0 10-3.58 10-8s-4.48-7-10-7z" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.6" />
  </svg>
)

const tabs = [
  { to: '/chats', label: 'Chats', icon: ChatIcon },
  { to: '/contacts', label: 'Contacts', icon: ContactsIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export function ShellLayout() {
  const location = useLocation()

  return (
    <div className="flex min-h-screen flex-col bg-(--color-bg) text-fg selection:bg-(--color-accent)/30 selection:text-white">
      {/* WhatsApp-style Header */}
      <header className="glass-header sticky top-0 z-50 px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex items-center gap-3 select-none">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-(--color-cyber-blue) to-(--color-node-purple) flex items-center justify-center shadow-lg text-white">
              <DecentralizedLogo />
            </div>
            <div>
              <span className="text-sm font-semibold tracking-wide text-fg">
                RetroChat
              </span>
              <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-(--color-cyber-blue)/15 text-(--color-cyber-blue) uppercase tracking-wider">
                Web3
              </span>
            </div>
          </div>
          <div className="online-indicator" title="Connected" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-scroll safe-area-bottom">
        <div className="mx-auto max-w-lg px-4 py-4 pb-20">
          <Outlet />
        </div>
      </main>

      {/* iOS-style Bottom Tab Bar */}
      <nav className="tab-bar z-50 flex items-start justify-around">
        {tabs.map((tab) => {
          const isActive = location.pathname.startsWith(tab.to)
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={`tab-item ${isActive ? 'active' : ''}`}
            >
              <Icon />
              <span className="text-[10px] font-medium tracking-wide">
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-(--color-accent)" />
              )}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}

