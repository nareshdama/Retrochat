import type { MessageEnvelope } from '../core/protocol'

export type TransportError = {
  code: string
  message: string
  details?: unknown
}

export type TransportStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export type MessageHandler = (envelope: MessageEnvelope) => void | Promise<void>

export interface ITransport {
  readonly status: TransportStatus
  readonly error: TransportError | null

  /**
   * Connect to the transport with the given wallet address.
   */
  connect(address: string): Promise<void>
  
  /**
   * Send a message envelope to the network.
   */
  send(envelope: MessageEnvelope): Promise<void>
  
  /**
   * Subscribe to incoming messages. Returns an unsubscribe function.
   */
  subscribe(handler: MessageHandler): () => void
  
  /**
   * Disconnect from the transport and clean up resources.
   */
  disconnect(): Promise<void>
  
  /**
   * Get the X25519 public key for a peer address for E2E encryption.
   * Returns null if the peer's key is not available.
   */
  getPeerPublicKey?(peerAddress: string): Promise<string | null>
}
