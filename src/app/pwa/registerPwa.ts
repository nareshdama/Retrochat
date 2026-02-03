import { registerSW } from 'virtual:pwa-register'

export function initPwa() {
  if (!('serviceWorker' in navigator)) return

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      const shouldRefresh = window.confirm(
        'A new version of Retrochat is available. Refresh now to update?',
      )
      if (shouldRefresh) {
        void updateSW()
      }
    },
    onOfflineReady() {
      // eslint-disable-next-line no-console
      console.info('[PWA] Offline shell is ready.')
    },
  })
}

