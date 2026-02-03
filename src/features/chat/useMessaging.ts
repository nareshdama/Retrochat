import { useEffect, useRef, useState, useCallback } from 'react'
import { useWallet } from '../../wallet/hooks/useWallet'
import { useVaultSession } from '../../core/session/VaultSession'
import { createTransport, type ITransport, type TransportType } from '../../transport'
import { storeMessage, getMessage } from '../../storage/messagesRepo'
import type { MessageId } from '../../core/protocol'
import { deriveMessageId } from '../../core/protocol'
import type { MessageEnvelope } from '../../core/protocol'
import { safeParseMessageEnvelope } from '../../core/validate/message'
import { logLocalError } from '../../app/errors/localTelemetry'
import { deriveConversationKey } from '../../crypto/conversationKeys'
import { getOrCreateIdentityKeyPair, fromHex } from '../../crypto/identityKeys'

export type MessagingState = {
  transport: ITransport | null
  isConnecting: boolean
  error: string | null
}

export function useMessaging() {
  const { address, isConnected } = useWallet()
  const { session } = useVaultSession()
  const [state, setState] = useState<MessagingState>({
    transport: null,
    isConnecting: false,
    error: null,
  })

  const processedMessageIds = useRef<Set<MessageId>>(new Set())
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const conversationKeyCache = useRef<Map<string, CryptoKey>>(new Map())
  const transportRef = useRef<ITransport | null>(null)

  const unlocked = session.status === 'unlocked'
  const dsk = unlocked ? session.dsk : null

  const getConversationKey = useCallback(
    async (myAddress: string, peerAddress: string, peerPublicKeyHex?: string): Promise<CryptoKey> => {
      if (!dsk || !address || !unlocked) {
        throw new Error('Vault must be unlocked to derive conversation keys.')
      }

      const cacheKey = `${myAddress.toLowerCase()}:${peerAddress.toLowerCase()}`
      const cached = conversationKeyCache.current.get(cacheKey)
      if (cached) {
        return cached
      }

      // Get or create identity keypair
      const identity = await getOrCreateIdentityKeyPair(dsk)

      // TODO: Fetch peer public key from XMTP or contacts if not provided
      // For now, we require peerPublicKeyHex to be passed in
      // In production, this would be fetched from XMTP user contact or contacts repo
      if (!peerPublicKeyHex) {
        throw new Error(
          'Peer public key is required. Fetch from XMTP user contact or contacts repository.',
        )
      }

      const peerPublicKey = fromHex(peerPublicKeyHex)
      const { key } = await deriveConversationKey({
        myPrivateKey: identity.privateKey,
        peerPublicKey,
        myAddress,
        peerAddress,
      })

      conversationKeyCache.current.set(cacheKey, key)
      return key
    },
    [dsk, address, unlocked],
  )

  const connectTransport = useCallback(async () => {
    if (!isConnected || !address || !unlocked) {
      return
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }))

    try {
      const transportType: TransportType =
        import.meta.env.VITE_APP_ENV === 'production' ? 'xmtp' : 'mock'

      const transport = createTransport(transportType)
      await transport.connect(address)

      // Subscribe to incoming messages and store them locally
      const unsubscribe = transport.subscribe(async (envelope) => {
        try {
          // Validate any external payloads (defense in depth; XMTP transport also validates).
          const validated = safeParseMessageEnvelope(envelope as unknown)
          if (!validated.ok) {
            return
          }

          const messageId = deriveMessageId(envelope)

          // Deduplicate: skip if we've already processed this message
          if (processedMessageIds.current.has(messageId)) {
            return
          }

          // Determine which address is "mine" for key derivation
          const isIncoming = envelope.to.toLowerCase() === address.toLowerCase()
          const myAddr = address
          const peerAddr = isIncoming ? envelope.from : envelope.to

          // Fetch peer public key from XMTP user contact
          let peerPublicKeyHex: string | null = null
          if ('getPeerPublicKey' in transport) {
            try {
              peerPublicKeyHex = await (transport as { getPeerPublicKey: (addr: string) => Promise<string | null> }).getPeerPublicKey(peerAddr)
            } catch {
              // Fallback: try to get from contacts or other sources
            }
          }

          if (!peerPublicKeyHex) {
            return
          }

          try {
            // Derive conversation key with peer public key
            const conversationKey = await getConversationKey(myAddr, peerAddr, peerPublicKeyHex)

            // Check if message already exists in storage (idempotent)
            const existing = await getMessage({
              messageId,
              conversationKey,
            })

            if (existing) {
              processedMessageIds.current.add(messageId)
              return
            }

            // Store message encrypted
            await storeMessage({
              conversationKey,
              envelope,
            })

            processedMessageIds.current.add(messageId)
          } catch (err) {
            // Log but don't crash on individual message failures
            logLocalError({ scope: 'useMessaging.incoming.store', error: err })
          }
        } catch (err) {
          // Log but don't crash on individual message failures
          logLocalError({ scope: 'useMessaging.incoming', error: err })
        }
      })

      unsubscribeRef.current = unsubscribe
      transportRef.current = transport

      setState({
        transport,
        isConnecting: false,
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to XMTP.'
      setState({
        transport: null,
        isConnecting: false,
        error: message,
      })
    }
  }, [address, isConnected, unlocked, getConversationKey])

  const disconnectTransport = useCallback(async () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }

    const currentTransport = transportRef.current
    if (currentTransport) {
      try {
        await currentTransport.disconnect()
      } catch {
        // Ignore disconnect errors
      }
      transportRef.current = null
    }

    processedMessageIds.current.clear()
    setState({
      transport: null,
      isConnecting: false,
      error: null,
    })
  }, []) // No dependencies - uses refs

  // Connect/disconnect effect - runs only when auth state changes
  useEffect(() => {
    if (isConnected && address && unlocked) {
      void connectTransport()
    } else {
      void disconnectTransport()
    }

    return () => {
      void disconnectTransport()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, unlocked]) // Intentionally exclude connect/disconnect to prevent loops

  const sendMessage = useCallback(
    async (options: { envelope: MessageEnvelope; peerPublicKeyHex?: string }) => {
      const { envelope, peerPublicKeyHex } = options

      if (!state.transport || state.transport.status !== 'connected') {
        throw new Error('Transport is not connected.')
      }

      if (!address) {
        throw new Error('Wallet address is not available.')
      }

      if (!unlocked) {
        throw new Error('Vault is not unlocked.')
      }

      try {
        // Send via transport
        await state.transport.send(envelope)

        // Store locally encrypted (deduplication handled by storeMessage)
        // TODO: Fetch peer public key from XMTP user contact or contacts
        // For now, this requires peerPublicKeyHex to be available
        // In production, fetch from XMTP: const peerContact = await client.getUserContact(envelope.to)
        if (!peerPublicKeyHex) {
          throw new Error('Peer public key is required to encrypt and store message.')
        }
        const conversationKey = await getConversationKey(envelope.from, envelope.to, peerPublicKeyHex)
        const messageId = await storeMessage({
          conversationKey,
          envelope,
        })

        processedMessageIds.current.add(messageId)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send message.'
        throw new Error(message)
      }
    },
    [state.transport, address, unlocked, getConversationKey],
  )

  return {
    transport: state.transport,
    isConnecting: state.isConnecting,
    error: state.error,
    sendMessage,
    connectTransport,
    disconnectTransport,
    getConversationKey,
  }
}
