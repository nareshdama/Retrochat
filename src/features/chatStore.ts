import { useMemo } from 'react'
import { create } from 'zustand'

export type Conversation = {
  id: string
  title: string
  lastMessageAt: string
  peerAddress?: string
}

export type ChatState = {
  conversations: Record<string, Conversation>
  upsertConversation: (conv: Conversation) => void
}

const useChatStoreInternal = create<ChatState>((set) => ({
  conversations: {},
  upsertConversation: (conv) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [conv.id]: conv,
      },
    })),
}))

/**
 * Hook that returns sorted conversations (most recent first).
 * The sorted array is memoized to avoid re-sorting on every render.
 */
export function useConversations() {
  const conversations = useChatStoreInternal((s) => s.conversations)
  
  // Memoize the sorted array based on the conversations object
  // This prevents re-sorting on every render when conversations haven't changed
  return useMemo(() => {
    return Object.values(conversations).sort((a, b) =>
      b.lastMessageAt.localeCompare(a.lastMessageAt)
    )
  }, [conversations])
}

export function useConversation(conversationId: string | undefined) {
  return useChatStoreInternal((s) =>
    conversationId ? s.conversations[conversationId] ?? null : null,
  )
}

export const chatStore = useChatStoreInternal

