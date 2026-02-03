import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useConversation, useConversations, chatStore } from './chatStore'
import { useVaultSession } from '../core/session/VaultSession'
import { listContacts, getContactByAddress } from '../storage/contactsRepo'
import type { Contact } from '../storage/contactsRepo'
import { ChatWindow } from './chat/components/ChatWindow'
import { Button } from '../ui/components/Button'
import { Modal } from '../ui/components/Modal'

export function ChatPage() {
  const { conversationId } = useParams<{ conversationId?: string }>()
  const navigate = useNavigate()
  const conversations = useConversations()
  const current = useConversation(conversationId)
  const { session } = useVaultSession()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [peerPublicKey, setPeerPublicKey] = useState<string | undefined>(undefined)

  // Note: No auto-redirect to first conversation so Back button works properly
  // Users should be able to see the conversation list

  // Load contacts when picker opens and vault is unlocked.
  useEffect(() => {
    if (!pickerOpen || session.status !== 'unlocked') {
      setContacts([])
      return
    }
    let cancelled = false
    listContacts(session.dsk)
      .then((list) => {
        if (!cancelled) setContacts(list)
      })
      .catch(() => {
        if (!cancelled) setContacts([])
      })
    return () => {
      cancelled = true
    }
  }, [pickerOpen, session.status, session.status === 'unlocked' ? session.dsk : null])

  const handleSelectContact = (contact: Contact) => {
    chatStore.getState().upsertConversation({
      id: contact.id,
      title: contact.label,
      lastMessageAt: new Date().toISOString(),
      peerAddress: contact.address,
    })
    navigate(`/chats/${contact.id}`)
    setPickerOpen(false)
  }

  // Fetch peer public key from contacts when conversation changes
  useEffect(() => {
    if (!current?.peerAddress || session.status !== 'unlocked') {
      setPeerPublicKey(undefined)
      return
    }
    let cancelled = false
    getContactByAddress({ dsk: session.dsk, address: current.peerAddress })
      .then((contact) => {
        if (!cancelled) {
          setPeerPublicKey(contact?.publicKeyHex)
        }
      })
      .catch(() => {
        if (!cancelled) setPeerPublicKey(undefined)
      })
    return () => {
      cancelled = true
    }
  }, [current?.peerAddress, session])

  // Mobile: Show chat view when conversation selected, list otherwise
  const showChatView = !!current

  return (
    <div className="flex flex-col h-full -mx-4 -my-4">
      {/* Mobile: Show either list or chat */}
      {!showChatView ? (
        // Conversation List View
        <div className="flex flex-col h-full">
          <div className="px-4 pt-2 pb-3">
            <Button
              type="button"
              variant="solid"
              size="sm"
              className="w-full"
              onClick={() => setPickerOpen(true)}
            >
              + New Chat
            </Button>
          </div>

          {conversations.length === 0 ? (
            <div className="flex-1 flex items-center justify-center px-4">
              <p className="text-sm text-fg-muted text-center">
                No conversations yet.<br />
                Start a new chat to begin.
              </p>
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto">
              {conversations.map((conv) => {
                const isActive = conv.id === conversationId
                return (
                  <li key={conv.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/chats/${conv.id}`)}
                      className={[
                        'flex w-full items-center gap-3 px-4 py-3 text-left touch-feedback border-b border-white/5',
                        isActive ? 'bg-white/5' : '',
                      ].join(' ')}
                    >
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-linear-to-br from-(--color-accent)/20 to-(--color-accent)/5 flex items-center justify-center text-lg">
                        {conv.title.charAt(0).toUpperCase()}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-fg truncate">{conv.title}</span>
                          <span className="text-xs text-fg-muted shrink-0">
                            {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-fg-muted truncate mt-0.5">
                          Tap to view messages
                        </p>
                      </div>
                      {/* Chevron */}
                      <span className="text-fg-muted">›</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : (
        // Chat View
        <div className="flex flex-col h-full">
          {/* Chat Header */}
          <div className="glass-header flex items-center gap-3 px-4 py-3 border-b border-white/5">
            <button
              type="button"
              onClick={() => navigate('/chats')}
              className="text-(--color-accent) text-sm font-medium flex items-center gap-1"
            >
              ‹ Back
            </button>
            <div className="flex-1 text-center">
              <h2 className="font-semibold text-fg">{current.title}</h2>
            </div>
            <div className="w-12" /> {/* Spacer for centering */}
          </div>

          {/* Chat Messages */}
          <div className="flex-1 min-h-0">
            <ChatWindow
              conversationId={current.id}
              peerAddress={current.peerAddress ?? current.id}
              peerPublicKeyHex={peerPublicKey}
            />
          </div>
        </div>
      )}

      {/* Contact Picker Modal */}
      <Modal
        title="New Conversation"
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
      >
        {session.status !== 'unlocked' ? (
          <p className="text-sm text-fg-muted">
            Unlock your vault and add contacts to start a chat.{' '}
            <Link to="/contacts" className="text-(--color-accent) hover:underline">
              Go to Contacts
            </Link>
          </p>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-fg-muted">
            No contacts yet.{' '}
            <Link to="/contacts" className="text-(--color-accent) hover:underline">
              Add contacts first
            </Link>
          </p>
        ) : (
          <ul className="space-y-1 max-h-64 overflow-y-auto -mx-2">
            {contacts.map((contact) => (
              <li key={contact.id}>
                <button
                  type="button"
                  onClick={() => handleSelectContact(contact)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left touch-feedback"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-(--color-accent)/20 to-(--color-accent)/5 flex items-center justify-center">
                    {contact.label.charAt(0).toUpperCase()}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-fg">{contact.label}</span>
                      {contact.publicKeyHex && (
                        <span className="text-[10px] text-(--color-accent)" title="E2E encryption enabled">🔐</span>
                      )}
                    </div>
                    <code className="text-xs text-fg-muted font-mono">
                      {contact.address.slice(0, 6)}…{contact.address.slice(-4)}
                    </code>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}
