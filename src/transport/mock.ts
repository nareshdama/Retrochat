import type { ITransport, MessageHandler, TransportError } from './ITransport'
import type { MessageEnvelope } from '../core/protocol'
import { generateX25519KeyPair } from '../crypto/ecdh'
import { toHex } from '../crypto/identityKeys'

// Deterministic mock peer public key for dev (same for all peers in mock mode).
const MOCK_PEER_PUBLIC_KEY_HEX = toHex(generateX25519KeyPair().publicKey)

export class MockTransport implements ITransport {
  private _status: ITransport['status'] = 'disconnected'
  private _error: TransportError | null = null
  private _address: string | null = null
  private _handlers: Set<MessageHandler> = new Set()
  private _sentMessages: MessageEnvelope[] = []

  get status(): ITransport['status'] {
    return this._status
  }

  get error(): TransportError | null {
    return this._error
  }

  async connect(address: string): Promise<void> {
    if (this._status === 'connected') {
      throw new Error('Transport already connected.')
    }

    this._status = 'connecting'
    this._error = null

    // Simulate async connection delay
    await new Promise((resolve) => setTimeout(resolve, 100))

    this._address = address
    this._status = 'connected'
  }

  async send(envelope: MessageEnvelope): Promise<void> {
    if (this._status !== 'connected') {
      const error: TransportError = {
        code: 'NOT_CONNECTED',
        message: 'Transport is not connected. Call connect() first.',
      }
      this._error = error
      throw error
    }

    if (!envelope.from || !envelope.to) {
      const error: TransportError = {
        code: 'INVALID_ENVELOPE',
        message: 'Message envelope missing required fields (from/to).',
      }
      throw error
    }

    // Store sent message for testing
    this._sentMessages.push(envelope)

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 50))

    // In mock mode, echo message back to self if recipient matches connected address
    if (envelope.to.toLowerCase() === this._address?.toLowerCase()) {
      const echoEnvelope: MessageEnvelope = {
        ...envelope,
        from: envelope.to,
        to: envelope.from,
      }
      setTimeout(() => {
        this._handlers.forEach((handler) => {
          void handler(echoEnvelope)
        })
      }, 100)
    }
  }

  subscribe(handler: MessageHandler): () => void {
    this._handlers.add(handler)
    return () => {
      this._handlers.delete(handler)
    }
  }

  async getPeerPublicKey(_peerAddress: string): Promise<string | null> {
    if (this._status !== 'connected') return null
    return MOCK_PEER_PUBLIC_KEY_HEX
  }

  async disconnect(): Promise<void> {
    this._handlers.clear()
    this._address = null
    this._status = 'disconnected'
    this._error = null
  }

  // Test helpers (not part of ITransport interface)
  getSentMessages(): MessageEnvelope[] {
    return [...this._sentMessages]
  }

  simulateIncomingMessage(envelope: MessageEnvelope): void {
    if (this._status !== 'connected') {
      throw new Error('Cannot simulate incoming message: transport not connected.')
    }
    this._handlers.forEach((handler) => {
      void handler(envelope)
    })
  }
}
