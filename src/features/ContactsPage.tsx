import { useEffect, useMemo, useState } from 'react'
import { useVaultSession } from '../core/session/VaultSession'
import { useWallet } from '../wallet/hooks/useWallet'
import { Button } from '../ui/components/Button'
import { Input } from '../ui/components/Input'
import { Panel } from '../ui/components/Panel'
import { Toast } from '../ui/components/Toast'
import {
  createContact,
  deleteContact,
  listContacts,
  type Contact,
  updateContact,
} from '../storage/contactsRepo'

export function ContactsPage() {
  const { session } = useVaultSession()
  const { isConnected, address } = useWallet()

  const [contacts, setContacts] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [label, setLabel] = useState('')
  const [contactAddress, setContactAddress] = useState('')
  const [note, setNote] = useState('')
  const [publicKeyHex, setPublicKeyHex] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const unlocked = session.status === 'unlocked'

  useEffect(() => {
    if (!unlocked) return
    let cancelled = false

    const run = async () => {
      try {
        const items = await listContacts(session.dsk)
        if (!cancelled) {
          setContacts(items)
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to load contacts. Please try again.'
          setError(message)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [session, unlocked])

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter((c) => {
      return (
        c.label.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        (c.note ?? '').toLowerCase().includes(q)
      )
    })
  }, [contacts, search])

  const resetForm = () => {
    setLabel('')
    setContactAddress('')
    setNote('')
    setPublicKeyHex('')
    setEditingId(null)
    setError(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!unlocked) return

    setBusy(true)
    setError(null)
    try {
      if (!label.trim()) {
        throw new Error('Label is required.')
      }

      if (!editingId && !contactAddress.trim()) {
        throw new Error('Address is required.')
      }

      if (editingId) {
        const updated = await updateContact({
          dsk: session.dsk,
          id: editingId,
          label: label.trim(),
          note: note.trim() || undefined,
          publicKeyHex: publicKeyHex.trim() || undefined,
        })
        setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      } else {
        const created = await createContact({
          dsk: session.dsk,
          address: contactAddress,
          label: label.trim(),
          note: note.trim() || undefined,
          publicKeyHex: publicKeyHex.trim() || undefined,
        })
        setContacts((prev) => [created, ...prev])
      }
      resetForm()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save contact. Please try again.'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (contact: Contact) => {
    setEditingId(contact.id)
    setLabel(contact.label)
    setContactAddress(contact.address)
    setNote(contact.note ?? '')
    setPublicKeyHex(contact.publicKeyHex ?? '')
    setError(null)
  }

  const handleDelete = async (id: string) => {
    if (!unlocked) return
    const confirmed = window.confirm('Delete this contact? This cannot be undone.')
    if (!confirmed) return

    setBusy(true)
    try {
      await deleteContact({ id })
      setContacts((prev) => prev.filter((c) => c.id !== id))
      if (editingId === id) {
        resetForm()
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete contact. Please try again.'
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  if (!unlocked) {
    return (
      <div className="flex h-full items-center justify-center">
        <Panel
          title="Contacts"
          description="Unlock your vault with your wallet to manage encrypted contacts."
          className="max-w-md"
        >
          <Toast kind="warning">
            Vault is locked. Go to <code className="font-mono">/vault</code> and unlock with
            your wallet first.
          </Toast>
        </Panel>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="shrink-0 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-(--color-accent)">Contacts</h1>
            <p className="text-xs text-fg-muted mt-1">
              Encrypted in your local vault
            </p>
          </div>
          {isConnected && address && (
            <code className="text-[10px] text-fg-muted font-mono bg-white/5 px-2 py-1 rounded">
              {address.slice(0, 6)}...{address.slice(-4)}
            </code>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="space-y-4 pb-4">
        {/* Add/Edit Contact Form */}
        <Panel
          title={editingId ? 'Edit contact' : 'Add contact'}
          description="Addresses use EIP-55 checksum format."
        >
          <form className="space-y-3 max-h-[280px] overflow-y-auto pr-1" onSubmit={handleSubmit}>
            <Input
              label="Label"
              placeholder="Alice"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
            {!editingId && (
              <Input
                label="Address"
                placeholder="0x..."
                value={contactAddress}
                onChange={(event) => setContactAddress(event.target.value)}
              />
            )}
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-fg-muted">
                Note
              </label>
              <textarea
                className="min-h-[60px] w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-fg outline-none focus:border-(--color-accent) focus:ring-1 focus:ring-(--color-accent)"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <Input
              label="Public Key (X25519)"
              placeholder="Optional – for E2E encryption"
              value={publicKeyHex}
              onChange={(event) => setPublicKeyHex(event.target.value)}
            />

            {error && <Toast kind="warning">{error}</Toast>}

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={busy}>
                {editingId ? 'Save' : 'Add'}
              </Button>
              {editingId && (
                <Button variant="outline" type="button" onClick={resetForm} disabled={busy}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Panel>

        {/* Contact List */}
        <Panel
          title="Contact list"
          description="Search runs locally on decrypted data."
        >
          <div className="mb-3">
            <Input
              label="Search"
              placeholder="Search by label or address"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {filteredContacts.length === 0 ? (
            <p className="text-xs text-fg-muted py-4 text-center">No contacts yet.</p>
          ) : (
            <ul className="space-y-2 max-h-[200px] overflow-y-scroll pr-2 -mr-2">
              {filteredContacts.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start justify-between gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2"
                >
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="font-medium text-fg text-sm">{c.label}</div>
                    <code className="block font-mono text-[10px] text-fg-muted truncate">
                      {c.address}
                    </code>
                    {c.publicKeyHex && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-(--color-matrix-green)">🔑</span>
                        <code className="font-mono text-[9px] text-(--color-matrix-green)/70 truncate">
                          {c.publicKeyHex.slice(0, 8)}…
                        </code>
                      </div>
                    )}
                    {c.note && (
                      <p className="text-[10px] text-fg-muted line-clamp-2">{c.note}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => startEdit(c)}
                      disabled={busy}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => void handleDelete(c.id)}
                      disabled={busy}
                      className="text-rose-400"
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}


