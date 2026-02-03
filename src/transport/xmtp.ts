import type { ITransport, MessageHandler, TransportError } from './ITransport'
import type { MessageEnvelope } from '../core/protocol'
import { safeParseMessageEnvelope } from '../core/validate/message'
import { logLocalError } from '../app/errors/localTelemetry'
import { detectMetaMask } from '../wallet/provider/detectMetaMask'
import { createMetaMaskSigner } from './xmtpSigner'
import { loadXmtpSdk } from './xmtpSdk'

export class XmtpTransport implements ITransport {
  private _status: ITransport['status'] = 'disconnected'
  private _error: TransportError | null = null
  private _address: string | null = null
  private _handlers: Set<MessageHandler> = new Set()
  private _client: (import('@xmtp/xmtp-js').Client) | null = null
  private _isStreaming = false
  private _abortController: AbortController | null = null
  // Cache for peer public keys to avoid repeated lookups
  private _peerKeyCache: Map<string, string | null> = new Map()

  async getPeerPublicKey(peerAddress: string): Promise<string | null> {
    if (!this._client || this._status !== 'connected') {
      return null
    }

    const normalizedAddress = peerAddress.toLowerCase()
    
    // Check cache first
    if (this._peerKeyCache.has(normalizedAddress)) {
      return this._peerKeyCache.get(normalizedAddress) ?? null
    }

    try {
      // Check if the peer is registered on XMTP
      const canMessage = await this._client.canMessage(peerAddress)
      if (!canMessage) {
        this._peerKeyCache.set(normalizedAddress, null)
        return null
      }

      // XMTP handles key exchange internally through the SDK
      // For E2E encryption, we use XMTP's built-in encryption
      // Return a placeholder to indicate the peer is reachable
      // The actual key exchange happens through XMTP's protocol
      const contact = await this._client.getUserContact(peerAddress)
      type ContactWithBundle = {
        keyBundle?: { identityKey?: { secp256k1Uncompressed?: { bytes: Uint8Array } } }
      }
      const contactWithBundle =
        contact && typeof contact === 'object' && 'keyBundle' in contact
          ? (contact as ContactWithBundle)
          : null

      if (contactWithBundle?.keyBundle?.identityKey?.secp256k1Uncompressed) {
        const publicKeyBytes = contactWithBundle.keyBundle.identityKey.secp256k1Uncompressed.bytes
        const publicKeyHex = Array.from(new Uint8Array(publicKeyBytes))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
        this._peerKeyCache.set(normalizedAddress, publicKeyHex)
        return publicKeyHex
      }

      // Peer is reachable but key not extractable - XMTP will handle encryption
      this._peerKeyCache.set(normalizedAddress, null)
      return null
    } catch (err) {
      logLocalError({ scope: 'XmtpTransport.getPeerPublicKey', error: err })
      return null
    }
  }

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

    if (!address || address.length < 10) {
      const error: TransportError = {
        code: 'INVALID_ADDRESS',
        message: 'Invalid address provided for XMTP connection.',
      }
      throw error
    }

    const provider = detectMetaMask()
    if (!provider) {
      const error: TransportError = {
        code: 'WALLET_NOT_AVAILABLE',
        message: 'MetaMask is not available. Please install MetaMask to use XMTP.',
      }
      this._error = error
      this._status = 'error'
      throw error
    }

    // Validate wallet signer exists and matches connected address
    try {
      const accounts = (await provider.request({ method: 'eth_accounts' })) as string[]
      if (!accounts || accounts.length === 0) {
        const error: TransportError = {
          code: 'WALLET_NOT_CONNECTED',
          message: 'No wallet account found. Please connect your wallet first.',
        }
        throw error
      }

      const connectedAddress = accounts[0]?.toLowerCase()
      if (connectedAddress !== address.toLowerCase()) {
        const error: TransportError = {
          code: 'ADDRESS_MISMATCH',
          message: `Connected wallet address (${connectedAddress}) does not match requested address (${address}).`,
        }
        throw error
      }
    } catch (err) {
      if (err instanceof Error && 'code' in err) {
        throw err
      }
      const error: TransportError = {
        code: 'WALLET_VALIDATION_FAILED',
        message: err instanceof Error ? err.message : 'Failed to validate wallet connection.',
        details: err,
      }
      throw error
    }

    this._status = 'connecting'
    this._error = null

    try {
      const signer = createMetaMaskSigner(provider, address)
      const { Client } = await loadXmtpSdk()
      this._client = await Client.create(signer, {
        env: (import.meta as unknown as { env: { VITE_XMTP_ENV?: string } }).env.VITE_XMTP_ENV as 'local' | 'dev' | 'production' ??
          'production',
      })

      await this._client.publishUserContact()

      this._address = address.toLowerCase()
      this._status = 'connected'
      void this._address // Used for validation, suppress unused warning
    } catch (err) {
      const error: TransportError = {
        code: 'XMTP_CONNECTION_FAILED',
        message: err instanceof Error ? err.message : 'Failed to connect to XMTP network.',
        details: err,
      }
      this._error = error
      this._status = 'error'
      throw error
    }
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

    if (!this._client) {
      const error: TransportError = {
        code: 'CLIENT_NOT_INITIALIZED',
        message: 'XMTP client is not initialized.',
      }
      throw error
    }

    try {
      const conversation = await this._client.conversations.newConversation(envelope.to)
      await conversation.send(JSON.stringify(envelope))
    } catch (err) {
      const error: TransportError = {
        code: 'XMTP_SEND_FAILED',
        message: err instanceof Error ? err.message : 'Failed to send message via XMTP.',
        details: err,
      }
      this._error = error
      throw error
    }
  }

  subscribe(handler: MessageHandler): () => void {
    this._handlers.add(handler)

    // Only start streaming if not already streaming and client is available
    if (this._client && !this._isStreaming) {
      this._startStreaming()
    }

    return () => {
      this._handlers.delete(handler)
      // Stop streaming if no more handlers
      if (this._handlers.size === 0) {
        this._stopStreaming()
      }
    }
  }

  private _startStreaming(): void {
    if (this._isStreaming || !this._client) {
      return
    }

    this._isStreaming = true
    this._abortController = new AbortController()

    const streamConversations = async () => {
      try {
        const client = this._client
        if (!client) return

        const stream = await client.conversations.stream()

        for await (const conversation of stream) {
          // Check if we should stop streaming
          if (!this._isStreaming || this._abortController?.signal.aborted) {
            break
          }

          try {
            // Stream messages from this conversation
            const messageStream = await conversation.streamMessages()
            for await (const message of messageStream) {
              // Check if we should stop streaming
              if (!this._isStreaming || this._abortController?.signal.aborted) {
                break
              }

              try {
                const parsed = JSON.parse(message.content) as unknown
                const validated = safeParseMessageEnvelope(parsed)
                if (!validated.ok) {
                  continue
                }
                const envelope = validated.value as unknown as MessageEnvelope
                // Call all handlers
                for (const h of this._handlers) {
                  try {
                    await h(envelope)
                  } catch (handlerErr) {
                    logLocalError({ scope: 'XmtpTransport.handler', error: handlerErr })
                  }
                }
              } catch (err) {
                logLocalError({ scope: 'XmtpTransport.subscribe.message', error: err })
                // Skip invalid message formats
              }
            }
          } catch (convErr) {
            logLocalError({ scope: 'XmtpTransport.subscribe.conversation', error: convErr })
            // Skip conversations that fail to stream messages
          }
        }
      } catch (err) {
        if (this._status === 'connected' && this._isStreaming) {
          const error: TransportError = {
            code: 'XMTP_SUBSCRIPTION_FAILED',
            message: err instanceof Error ? err.message : 'Failed to subscribe to XMTP messages.',
            details: err,
          }
          this._error = error
          this._status = 'error'
          logLocalError({ scope: 'XmtpTransport.subscribe', error: err })
        }
      } finally {
        this._isStreaming = false
      }
    }

    void streamConversations()
  }

  private _stopStreaming(): void {
    this._isStreaming = false
    if (this._abortController) {
      this._abortController.abort()
      this._abortController = null
    }
  }

  async disconnect(): Promise<void> {
    // Stop streaming first
    this._stopStreaming()

    if (this._client) {
      try {
        await this._client.close()
      } catch (err) {
        // Log cleanup errors but don't throw
        logLocalError({ scope: 'XmtpTransport.disconnect', error: err })
      }
    }

    this._handlers.clear()
    this._peerKeyCache.clear()
    this._address = null
    this._status = 'disconnected'
    this._error = null
    this._client = null
  }
}
