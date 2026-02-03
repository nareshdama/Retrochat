import { Virtuoso } from 'react-virtuoso'
import { MessageBubble } from '../components/MessageBubble'
import type { MessageEnvelope } from '../../../core/protocol'

export type UiMessage = {
  id: string
  envelope: MessageEnvelope
  deliveryState?: 'sending' | 'sent' | 'delivered' | 'failed'
}

export type VirtualizedMessageListProps = {
  messages: UiMessage[]
  myAddress: string
  getPlaintext: (id: string) => string | null
  onVisibleRangeChange?: (range: { startIndex: number; endIndex: number }) => void
}

export function VirtualizedMessageList({
  messages,
  myAddress,
  getPlaintext,
  onVisibleRangeChange,
}: VirtualizedMessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-fg-muted">
        <p>No messages yet. Start the conversation.</p>
      </div>
    )
  }

  return (
    <Virtuoso
      data={messages}
      style={{ height: '100%', width: '100%' }}
      computeItemKey={(_, item) => item.id}
      // Auto-follow new messages only when user is at bottom.
      followOutput={(isAtBottom) => (isAtBottom ? 'smooth' : false)}
      atBottomThreshold={96}
      rangeChanged={(range) => {
        onVisibleRangeChange?.({ startIndex: range.startIndex, endIndex: range.endIndex })
      }}
      increaseViewportBy={{ top: 400, bottom: 800 }}
      itemContent={(_, item) => {
        const isFromMe = item.envelope.from.toLowerCase() === myAddress.toLowerCase()
        const plaintext = getPlaintext(item.id) ?? '…'
        return (
          <div className="px-3 py-1">
            <MessageBubble
              envelope={item.envelope}
              isFromMe={isFromMe}
              plaintext={plaintext}
              deliveryState={item.deliveryState}
            />
          </div>
        )
      }}
      components={{
        List: (props) => <div {...props} className="flex flex-col gap-1 py-3" />,
      }}
    />
  )
}

