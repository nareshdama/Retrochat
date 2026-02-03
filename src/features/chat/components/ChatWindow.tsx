import { useEffect, useState, useCallback, useRef } from 'react'
import { useWallet } from '../../../wallet/hooks/useWallet'
import { useVaultSession } from '../../../core/session/VaultSession'
import { useMessaging } from '../useMessaging'
import { listMessages } from '../../../storage/messagesRepo'
import { decryptAead, encryptAead } from '../../../crypto/aead'
import { randomBytes } from '../../../crypto/random'
import { toHex, fromHex, getOrCreateIdentityKeyPair } from '../../../crypto/identityKeys'
import { deriveConversationKey } from '../../../crypto/conversationKeys'
import { deriveMessageId } from '../../../core/protocol'
import { mapBatched } from '../../../crypto/queue'
import { logLocalError } from '../../../app/errors/localTelemetry'
import type { MessageEnvelope } from '../../../core/protocol'
import { MessageInput } from './MessageInput'
import { Toast } from '../../../ui/components/Toast'
import { VirtualizedMessageList, type UiMessage } from '../perf/VirtualizedMessageList'

const MESSAGES_AAD_LABEL = new TextEncoder().encode('retrochat:messages:v1')

export type ChatWindowProps = {
  conversationId: string
  peerAddress: string
  peerPublicKeyHex?: string
}

export function ChatWindow({ conversationId, peerAddress, peerPublicKeyHex }: ChatWindowProps) {
  const { address } = useWallet()
  const { session } = useVaultSession()
  const { transport, error: transportError, sendMessage: sendViaTransport } = useMessaging()
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [fetchedPeerKeyHex, setFetchedPeerKeyHex] = useState<string | null>(null)
  const conversationKeyRef = useRef<CryptoKey | null>(null)
  const plaintextCacheRef = useRef<Map<string, string>>(new Map())
  const decryptingRef = useRef<Set<string>>(new Set())
  const decryptChainRef = useRef<Promise<void>>(Promise.resolve())
  const textDecoderRef = useRef<TextDecoder>(new TextDecoder())
  const [plaintextTick, setPlaintextTick] = useState(0)

  const unlocked = session.status === 'unlocked'
  const dsk = unlocked ? session.dsk : null

  const effectivePeerKeyHex = peerPublicKeyHex ?? fetchedPeerKeyHex

  // Debug logging removed - was causing render loop

  // Fetch peer public key from transport when prop is missing
  const transportStatus = transport?.status
  const transportHasGetPeerKey = transport && 'getPeerPublicKey' in transport

  useEffect(() => {
    if (peerPublicKeyHex != null || !peerAddress) {
      setFetchedPeerKeyHex(null)
      return
    }
    setFetchedPeerKeyHex(null) // reset when switching conversation before refetch
    if (transportStatus !== 'connected' || !transportHasGetPeerKey) return

    let cancelled = false
      ; (transport as { getPeerPublicKey: (addr: string) => Promise<string | null> })
        .getPeerPublicKey(peerAddress)
        .then((key) => {
          if (!cancelled && key) setFetchedPeerKeyHex(key)
        })
        .catch(() => {
          if (!cancelled) setFetchedPeerKeyHex(null)
        })
    return () => {
      cancelled = true
    }
  }, [peerPublicKeyHex, peerAddress, transportStatus, transportHasGetPeerKey, transport])

  // Load messages for this conversation
  useEffect(() => {
    if (!unlocked || !dsk || !address || !effectivePeerKeyHex) return

    const loadMessages = async () => {
      try {
        const identity = await getOrCreateIdentityKeyPair(dsk)
        const peerPublicKey = fromHex(effectivePeerKeyHex)
        const { key: conversationKey } = await deriveConversationKey({
          myPrivateKey: identity.privateKey,
          peerPublicKey,
          myAddress: address,
          peerAddress,
        })

        conversationKeyRef.current = conversationKey

        const envelopes = await listMessages({
          conversationKey,
          limit: 100,
        })

        // IMPORTANT: only decrypt message bodies for the visible window (see below).
        // Here we only load the envelopes (already decrypted from the vault).
        const ui: UiMessage[] = envelopes
          .slice()
          .reverse() // oldest -> newest for UI
          .map((envelope) => ({
            id: deriveMessageId(envelope),
            envelope,
            deliveryState: 'sent' as const,
          }))
        setMessages(ui)
      } catch (err) {
        // Error handling - don't log plaintext
        logLocalError({ scope: 'ChatWindow.loadMessages', error: err })
      }
    }

    void loadMessages()
  }, [unlocked, dsk, address, conversationId, peerAddress, effectivePeerKeyHex])

  // Subscribe to new messages from transport
  useEffect(() => {
    if (!transport || transport.status !== 'connected' || !conversationKeyRef.current) return

    const unsubscribe = transport.subscribe(async (envelope) => {
      // Only process messages for this conversation
      const isRelevant =
        (envelope.from.toLowerCase() === peerAddress.toLowerCase() &&
          envelope.to.toLowerCase() === address?.toLowerCase()) ||
        (envelope.to.toLowerCase() === peerAddress.toLowerCase() &&
          envelope.from.toLowerCase() === address?.toLowerCase())

      if (!isRelevant || !conversationKeyRef.current) return

      try {
        setMessages((prev) => {
          // Check for duplicates
          const id = deriveMessageId(envelope)
          const exists = prev.some((m) => m.id === id)
          if (exists) return prev

          return [
            ...prev,
            {
              id,
              envelope,
              deliveryState: 'sent',
            },
          ]
        })
      } catch {
        // Skip messages that fail to decrypt
      }
    })

    return unsubscribe
  }, [transport, peerAddress, address])

  const decryptBodiesForRange = useCallback(
    async (range: { startIndex: number; endIndex: number }) => {
      const key = conversationKeyRef.current
      if (!key) return

      // overscan a bit to avoid "decrypt pop-in" while scrolling
      const start = Math.max(0, range.startIndex - 12)
      const end = Math.min(messages.length - 1, range.endIndex + 12)

      const targets: UiMessage[] = []
      for (let i = start; i <= end; i += 1) {
        const item = messages[i]
        if (!item) continue
        if (plaintextCacheRef.current.has(item.id)) continue
        if (decryptingRef.current.has(item.id)) continue
        decryptingRef.current.add(item.id)
        targets.push(item)
      }

      if (targets.length === 0) return

      // Serialize decrypt work to avoid contention during fast scroll.
      decryptChainRef.current = decryptChainRef.current
        .then(async () => {
          try {
            await mapBatched({
              items: targets,
              batchSize: 6,
              map: async (item) => {
                const ciphertextBytes = fromHex(item.envelope.ciphertext)
                const ivBytes = fromHex(item.envelope.iv)
                const plaintextBytes = await decryptAead({
                  key,
                  record: { iv: ivBytes, ciphertext: ciphertextBytes },
                  aad: MESSAGES_AAD_LABEL,
                })
                const plaintext = textDecoderRef.current.decode(plaintextBytes)
                plaintextCacheRef.current.set(item.id, plaintext)
                return item.id
              },
              onBatch: () => {
                // Trigger a lightweight re-render without copying the whole message list.
                setPlaintextTick((t) => t + 1)
              },
            })
          } catch (err) {
            logLocalError({ scope: 'ChatWindow.decryptBodies', error: err })
          } finally {
            for (const item of targets) {
              decryptingRef.current.delete(item.id)
            }
          }
        })
        .catch(() => {
          // keep chain alive
        })
    },
    [messages],
  )

  const getPlaintext = useCallback(
    (id: string) => {
      void plaintextTick // make this value reactive in renders
      return plaintextCacheRef.current.get(id) ?? null
    },
    [plaintextTick],
  )

  const handleSend = useCallback(
    async (text: string) => {
      if (!address || !unlocked || !dsk || !effectivePeerKeyHex) {
        throw new Error('Cannot send: missing wallet, vault unlock, or peer public key.')
      }

      // Encrypt message plaintext
      const identity = await getOrCreateIdentityKeyPair(dsk)
      const peerPublicKey = fromHex(effectivePeerKeyHex)
      const { key: conversationKey } = await deriveConversationKey({
        myPrivateKey: identity.privateKey,
        peerPublicKey,
        myAddress: address,
        peerAddress,
      })

      const plaintextBytes = new TextEncoder().encode(text)
      const encrypted = await encryptAead({
        key: conversationKey,
        plaintext: plaintextBytes,
        aad: MESSAGES_AAD_LABEL,
      })

      const nonce = toHex(randomBytes(16))
      const ciphertextHex = toHex(encrypted.ciphertext)
      const ivHex = toHex(encrypted.iv)

      const envelope: MessageEnvelope = {
        v: 1,
        from: address,
        to: peerAddress,
        ts: new Date().toISOString(),
        nonce,
        iv: ivHex,
        ciphertext: ciphertextHex,
        aad: undefined,
      }

      const id = deriveMessageId(envelope)
      plaintextCacheRef.current.set(id, text)
      setPlaintextTick((t) => t + 1)

      // Optimistically add message
      setMessages((prev) => [
        ...prev,
        {
          id,
          envelope,
          deliveryState: 'sending',
        },
      ])

      try {
        await sendViaTransport({
          envelope,
          peerPublicKeyHex: effectivePeerKeyHex,
        })

        // Update delivery state
        setMessages((prev) =>
          prev.map((m) =>
            m.envelope.nonce === nonce ? { ...m, deliveryState: 'sent' as const } : m,
          ),
        )
      } catch (err) {
        // Update to failed state
        setMessages((prev) =>
          prev.map((m) =>
            m.envelope.nonce === nonce ? { ...m, deliveryState: 'failed' as const } : m,
          ),
        )
        throw err
      }
    },
    [address, unlocked, dsk, peerAddress, effectivePeerKeyHex, sendViaTransport],
  )

  return (
    <div className="flex flex-col h-full">
      {/* Messages area - scrollable */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {transportError && (
          <div className="px-3 py-2">
            <Toast kind="warning">{transportError}</Toast>
          </div>
        )}
        <VirtualizedMessageList
          messages={messages}
          myAddress={address ?? ''}
          getPlaintext={getPlaintext}
          onVisibleRangeChange={decryptBodiesForRange}
        />
      </div>

      {/* Peer key warning */}
      {!effectivePeerKeyHex && transport?.status === 'connected' && (
        <div className="px-3 py-2">
          <Toast kind="warning">
            Peer&apos;s encryption key not available yet. They may need to use the app first.
          </Toast>
        </div>
      )}

      {/* Input area - fixed at bottom */}
      <div className="flex-shrink-0 p-3">
        <MessageInput
          onSend={handleSend}
          disabled={!unlocked || !transport || transport.status !== 'connected'}
          sendDisabled={!effectivePeerKeyHex}
        />
      </div>
    </div>
  )
}
