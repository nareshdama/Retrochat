import { test, expect } from '@playwright/test'

const MOCK_ADDRESS = '0x1234567890123456789012345678901234567890'

test.describe('critical encrypted chat flow', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      const MOCK_ADDRESS = '0x1234567890123456789012345678901234567890'

      const ethereum = {
        isMetaMask: true,
        request: async ({ method }: { method: string; params?: unknown[] }) => {
          switch (method) {
            case 'eth_requestAccounts':
              return [MOCK_ADDRESS]
            case 'eth_chainId':
              return '0x1'
            case 'wallet_switchEthereumChain':
              return null
            case 'personal_sign':
              // Return a deterministic fake signature; content doesn't matter as long as it's hex.
              return `0x${'11'.repeat(32)}`
            default:
              return null
          }
        },
        on: () => {},
        removeListener: () => {},
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).ethereum = ethereum
    })
  })

  test('connect wallet, unlock vault, add contact, and verify encrypted persistence', async ({ page }) => {
    // Start at chats; RequireVault will redirect through /wallet and /vault flows.
    await page.goto('/chats')

    // Connect wallet via MetaMask mock.
    await page.getByRole('button', { name: 'Connect MetaMask' }).click()

    // After connection, app should redirect to /vault.
    await page.waitForURL('**/vault')

    // Unlock vault via wallet signature.
    await page.getByRole('button', { name: /Unlock vault via wallet/i }).click()

    // Successful unlock should land us on /chats.
    await page.waitForURL('**/chats')

    // Navigate to Contacts.
    await page.getByRole('link', { name: 'Contacts' }).click()
    await page.waitForURL('**/contacts')

    // Add a new encrypted contact.
    const secretNote = 'Test secret note that must never be stored in plaintext'

    await page.getByLabel('Label').fill('Alice')
    await page.getByLabel('Address').fill(MOCK_ADDRESS)
    await page.getByLabel('Note').fill(secretNote)
    await page.getByRole('button', { name: 'Add contact' }).click()

    await expect(page.getByText('Alice')).toBeVisible()

    // Reload the page to simulate a fresh session.
    await page.reload()

    // Verify that contacts are persisted in IndexedDB and that ciphertext,
    // not plaintext, is stored in the vault.
    const storageCheck = await page.evaluate(async (noteSubstring: string) => {
      if (typeof indexedDB === 'undefined') {
        throw new Error('IndexedDB is not available in this environment.')
      }

      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('retrochat-vault')
        req.onerror = () => reject(req.error ?? new Error('Failed to open vault DB'))
        req.onsuccess = () => resolve(req.result)
      })

      const tx = db.transaction('contacts', 'readonly')
      const store = tx.objectStore('contacts')

      const rows: unknown[] = await new Promise((resolve, reject) => {
        const result: unknown[] = []
        const req = store.getAll()
        req.onerror = () => reject(req.error ?? new Error('Failed to read contacts store'))
        req.onsuccess = () => {
          result.push(...(req.result as unknown[]))
          resolve(result)
        }
      })

      if (rows.length === 0) {
        throw new Error('No contacts found in vault after reload.')
      }

      // Ensure each row uses an encrypted blob with a non-string ciphertext.
      for (const row of rows as Array<{ blob: { ciphertext: unknown } }>) {
        if (!row || !row.blob || !row.blob.ciphertext) {
          throw new Error('Contact row is missing encrypted blob.')
        }

        if (typeof row.blob.ciphertext === 'string') {
          throw new Error('Ciphertext is unexpectedly stored as a string, not binary data.')
        }

        const serialized = JSON.stringify(row)
        if (serialized.includes(noteSubstring)) {
          throw new Error('Plaintext contact note was found in vault storage.')
        }
      }

      db.close()
      return { contactCount: rows.length }
    }, secretNote.slice(0, 16))

    expect(storageCheck.contactCount).toBeGreaterThan(0)
  })
})

