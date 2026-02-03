const HEX_SECRET_RE = /\b0x[a-fA-F0-9]{64,}\b/g
const LONG_HEX_RE = /\b[a-fA-F0-9]{80,}\b/g
const BASE64_LIKE_RE = /\b[A-Za-z0-9+/]{80,}={0,2}\b/g

export function redactSensitiveText(input: string): string {
  // Goal: avoid leaking signatures, ciphertext, keys, etc. Keep UX helpful but safe.
  const trimmed = input.trim()
  const capped = trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed

  return capped
    .replace(HEX_SECRET_RE, '0x[redacted]')
    .replace(LONG_HEX_RE, '[redacted]')
    .replace(BASE64_LIKE_RE, '[redacted]')
}

export function safeUserMessageFromError(err: unknown): string {
  if (err instanceof Error) {
    if (typeof err.message === 'string' && err.message.trim()) {
      return redactSensitiveText(err.message)
    }
  }
  return 'Something went wrong.'
}

