import { resetVault } from '../db'

export async function resetAppData(): Promise<void> {
  // 1) Best-effort unregister service workers (stop future cache writes)
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(
        regs.map(async (reg) => {
          try {
            await reg.unregister()
          } catch {
            // ignore
          }
        }),
      )
    } catch {
      // ignore
    }
  }

  // 2) Best-effort clear Cache Storage (Workbox/runtime caches)
  if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
    try {
      const keys = await caches.keys()
      await Promise.all(
        keys.map(async (key) => {
          try {
            await caches.delete(key)
          } catch {
            // ignore
          }
        }),
      )
    } catch {
      // ignore
    }
  }

  // 3) Wipe IndexedDB vault
  await resetVault()
}

