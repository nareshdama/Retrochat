import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const csp = (env.VITE_CSP ?? '').trim()

  const baseSecurityHeaders: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    // Keep COOP/CORP conservative; avoids cross-origin leaks while remaining compatible.
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  }

  const previewHeaders: Record<string, string> = {
    ...baseSecurityHeaders,
    // Enforce CSP in preview (prod-like). Use a header when possible.
    ...(csp ? { 'Content-Security-Policy': csp } : {}),
    // Avoid caching HTML responses on shared devices/proxies.
    'Cache-Control': 'no-store',
  }

  return {
    resolve: {
      alias: {
        buffer: 'buffer/',
      },
    },
    optimizeDeps: {
      include: ['buffer'],
    },
    server: {
      headers: {
        ...baseSecurityHeaders,
      },
    },
    preview: {
      headers: previewHeaders,
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
        manifest: {
          name: 'RetroChat - Decentralized Messaging',
          short_name: 'RetroChat',
          description: 'End-to-end encrypted decentralized messaging powered by Web3.',
          theme_color: '#0a0a0f',
          background_color: '#0a0a0f',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          categories: ['social', 'communication'],
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              // Security default: don't runtime-cache navigations (HTML). The offline shell
              // is handled via precache + navigateFallback; decrypted content never persists.
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkOnly',
            },
            {
              // Static assets (hashed JS/CSS, images, fonts) – safe to cache.
              urlPattern: ({ url }) =>
                url.origin === (globalThis as typeof globalThis & { location?: { origin: string } })
                  .location?.origin && url.pathname.startsWith('/assets/'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-assets',
              },
            },
          ],
        },
      }),
      visualizer({
        emitFile: true,
        filename: 'stats.html',
      }) as any,
    ],
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // React core
            if (id.includes('node_modules/react-dom')) return 'react-dom'
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-router')) return 'vendor'
            // XMTP and its heavy deps
            if (id.includes('node_modules/@xmtp/')) return 'xmtp'
            if (id.includes('node_modules/protobufjs') || id.includes('node_modules/@protobufjs')) return 'xmtp'
            // Viem / Ethereum libs (used by XMTP and wallet)
            if (id.includes('node_modules/viem') || id.includes('node_modules/ox')) return 'ethereum'
            // Crypto libs
            if (id.includes('node_modules/@noble/') || id.includes('node_modules/@scure/')) return 'crypto-lib'
            // Zustand, zod, other utils
            if (id.includes('node_modules/zustand') || id.includes('node_modules/zod')) return 'state'
          },
        },
      },
    },
  }
})
