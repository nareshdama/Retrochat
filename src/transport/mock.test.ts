import { describe, expect, it } from 'vitest'
import { MockTransport } from './mock'
import type { MessageEnvelope } from '../core/protocol'

describe('MockTransport', () => {
  it('implements ITransport contract', async () => {
    const transport = new MockTransport()

    expect(transport.status).toBe('disconnected')
    expect(transport.error).toBeNull()

    await transport.connect('0x1234567890123456789012345678901234567890')
    expect(transport.status).toBe('connected')

    const envelope: MessageEnvelope = {
      v: 1,
      from: '0x1234567890123456789012345678901234567890',
      to: '0x0987654321098765432109876543210987654321',
      ts: new Date().toISOString(),
      nonce: 'deadbeef',
      iv: '0123456789abcdef01234567',
      ciphertext: 'cafebabe',
    }

    await transport.send(envelope)
    expect(transport.getSentMessages()).toHaveLength(1)

    let received: MessageEnvelope | null = null
    const unsubscribe = transport.subscribe((msg) => {
      received = msg
    })

    transport.simulateIncomingMessage(envelope)
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(received).not.toBeNull()

    unsubscribe()
    await transport.disconnect()
    expect(transport.status).toBe('disconnected')
  })

  it('surfaces errors cleanly', async () => {
    const transport = new MockTransport()

    await expect(transport.send({} as MessageEnvelope)).rejects.toMatchObject({
      code: 'NOT_CONNECTED',
    })

    await transport.connect('0x1234567890123456789012345678901234567890')
    await expect(
      transport.send({
        v: 1,
        from: '',
        to: '',
        ts: '',
        nonce: '',
        iv: '',
        ciphertext: '',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_ENVELOPE',
    })
  })
})
