import { Buffer } from 'buffer'

// Ensure Node global Buffer exists BEFORE loading XMTP.
function ensureBufferGlobal(): void {
  const g = globalThis as typeof globalThis & { Buffer?: typeof Buffer }
  if (!g.Buffer) {
    g.Buffer = Buffer
  }
}

export async function loadXmtpSdk(): Promise<typeof import('@xmtp/xmtp-js')> {
  ensureBufferGlobal()
  // Dynamic import ensures XMTP evaluates after Buffer is defined.
  return import('@xmtp/xmtp-js')
}

