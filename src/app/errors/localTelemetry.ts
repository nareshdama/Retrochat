import { redactSensitiveText } from '../../core/validate/redact'

export type LocalTelemetryEvent =
  | {
      type: 'error'
      id: string
      at: string
      scope: string
      message: string
      name?: string
      stack?: string
    }
  | {
      type: 'info'
      id: string
      at: string
      scope: string
      message: string
    }

const MAX_EVENTS = 200
const buffer: LocalTelemetryEvent[] = []

function makeId(): string {
  // Not cryptographic; just a local correlation id.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function logLocalError(options: { scope: string; error: unknown }): string {
  const id = makeId()
  const at = new Date().toISOString()

  const name = options.error instanceof Error ? options.error.name : undefined
  const rawMessage = options.error instanceof Error ? options.error.message : String(options.error)
  const message = redactSensitiveText(rawMessage)
  const rawStack = options.error instanceof Error ? options.error.stack : undefined
  const stack = rawStack ? redactSensitiveText(rawStack) : undefined

  buffer.unshift({
    type: 'error',
    id,
    at,
    scope: options.scope,
    name,
    message,
    stack,
  })
  if (buffer.length > MAX_EVENTS) buffer.length = MAX_EVENTS

  // Local-only: dev console is acceptable, but keep it sanitized.
  // eslint-disable-next-line no-console
  console.error(`[telemetry:${options.scope}] (${id}) ${message}`)

  return id
}

export function logLocalInfo(options: { scope: string; message: string }): string {
  const id = makeId()
  const at = new Date().toISOString()
  buffer.unshift({
    type: 'info',
    id,
    at,
    scope: options.scope,
    message: redactSensitiveText(options.message),
  })
  if (buffer.length > MAX_EVENTS) buffer.length = MAX_EVENTS
  return id
}

export function getLocalTelemetry(): LocalTelemetryEvent[] {
  return [...buffer]
}

export function clearLocalTelemetry(): void {
  buffer.length = 0
}

