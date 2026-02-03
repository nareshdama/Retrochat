import { useMemo, useRef, useState } from 'react'
import { Panel } from '../../ui/components/Panel'
import { Button } from '../../ui/components/Button'
import { Input } from '../../ui/components/Input'
import { Toast } from '../../ui/components/Toast'
import { useVaultSession } from '../../core/session/VaultSession'
import { exportEncryptedBackup, importEncryptedBackup, type EncryptedBackupFileV1 } from '../../storage/backup/backup'
import { resetAppData } from '../../storage/backup/resetAppData'

function downloadJson(options: { filename: string; json: unknown }) {
  const blob = new Blob([JSON.stringify(options.json, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = options.filename
    a.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function SettingsPage() {
  const { lock } = useVaultSession()
  const [toast, setToast] = useState<{ kind: 'info' | 'success' | 'warning'; msg: string } | null>(null)

  const [exportPassphrase, setExportPassphrase] = useState('')
  const [importPassphrase, setImportPassphrase] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const canExport = exportPassphrase.trim().length >= 8 && !isExporting && !isImporting && !isResetting
  const canImport = importPassphrase.trim().length >= 8 && !isExporting && !isImporting && !isResetting

  const exportFilename = useMemo(() => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    return `retrochat-backup-${stamp}.json`
  }, [])

  const onLockNow = async () => {
    const ok = window.confirm('Lock now? This wipes the in-memory session key and requires re-unlock.')
    if (!ok) return
    lock()
    setToast({ kind: 'success', msg: 'Locked. Session key wiped from memory.' })
  }

  const onResetVault = async () => {
    const ok = window.confirm(
      'Reset vault? This permanently deletes ALL local data (IndexedDB + service worker caches). This cannot be undone.',
    )
    if (!ok) return

    setIsResetting(true)
    setToast(null)
    try {
      // Ensure session key reference is dropped first
      lock()
      await resetAppData()
      setToast({ kind: 'success', msg: 'Vault reset complete. Reloading…' })
      window.location.reload()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to reset vault.'
      setToast({ kind: 'warning', msg })
    } finally {
      setIsResetting(false)
    }
  }

  const onExportBackup = async () => {
    setIsExporting(true)
    setToast(null)
    try {
      const backup: EncryptedBackupFileV1 = await exportEncryptedBackup({ passphrase: exportPassphrase.trim() })
      downloadJson({ filename: exportFilename, json: backup })
      setToast({ kind: 'success', msg: 'Encrypted backup exported.' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to export backup.'
      setToast({ kind: 'warning', msg })
    } finally {
      setIsExporting(false)
    }
  }

  const onImportBackup = async () => {
    const file = fileInputRef.current?.files?.[0] ?? null
    if (!file) {
      setToast({ kind: 'warning', msg: 'Choose a backup file first.' })
      return
    }

    const ok = window.confirm(
      'Import backup? This will REPLACE your local vault data. Make sure your passphrase is correct.',
    )
    if (!ok) return

    setIsImporting(true)
    setToast(null)
    try {
      const text = await file.text()
      const json = JSON.parse(text) as unknown
      // Drop session key before replacing local vault
      lock()
      await importEncryptedBackup({ passphrase: importPassphrase.trim(), fileJson: json, mode: 'replace' })
      setToast({ kind: 'success', msg: 'Backup imported. Reloading…' })
      window.location.reload()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to import backup.'
      setToast({ kind: 'warning', msg })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 mb-4">
        <h1 className="text-lg font-semibold text-(--color-accent)">Settings</h1>
        <p className="text-xs text-fg-muted mt-1">Security & Backup</p>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pb-4">
        <Panel
          title="Security"
          description="Keys never written to localStorage. Backups are encrypted."
        >
          <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
            {toast ? <Toast kind={toast.kind}>{toast.msg}</Toast> : null}
            <div className="flex flex-wrap gap-2 sticky bottom-0 pt-2">
              <Button variant="outline" onClick={onLockNow} disabled={isResetting || isExporting || isImporting}>
                Lock now
              </Button>
              <Button
                variant="outline"
                onClick={onResetVault}
                disabled={isResetting || isExporting || isImporting}
                className="text-rose-400"
              >
                {isResetting ? 'Resetting…' : 'Reset vault'}
              </Button>
            </div>
          </div>
        </Panel>

        <Panel
          title="Encrypted backup"
          description="PBKDF2(SHA-256) + AES-GCM encryption."
        >
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
            {/* Export Section */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-(--color-accent) uppercase tracking-wide">Export</p>
              <Input
                label="Passphrase"
                type="password"
                value={exportPassphrase}
                onChange={(e) => setExportPassphrase(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                hint="Used to encrypt your backup."
              />
              <Button onClick={onExportBackup} disabled={!canExport}>
                {isExporting ? 'Exporting…' : 'Export backup'}
              </Button>
            </div>

            {/* Divider */}
            <div className="border-t border-white/5" />

            {/* Import Section */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-(--color-accent) uppercase tracking-wide">Import</p>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-wide text-fg-muted">
                  Backup file
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-fg file:mr-3 file:rounded-lg file:border-0 file:bg-(--color-accent)/20 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-(--color-accent)"
                />
                <p className="text-[10px] text-fg-muted">Replaces local vault after validation.</p>
              </div>

              <Input
                label="Passphrase"
                type="password"
                value={importPassphrase}
                onChange={(e) => setImportPassphrase(e.target.value)}
                autoComplete="current-password"
                placeholder="Passphrase from export"
              />

              <Button variant="outline" onClick={onImportBackup} disabled={!canImport}>
                {isImporting ? 'Importing…' : 'Import backup'}
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}


