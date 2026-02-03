import type { MessageEnvelope } from '../../../core/protocol'

export type MessageBubbleProps = {
  envelope: MessageEnvelope
  isFromMe: boolean
  plaintext: string
  deliveryState?: 'sending' | 'sent' | 'delivered' | 'failed'
}

export function MessageBubble({ envelope, isFromMe, plaintext, deliveryState }: MessageBubbleProps) {
  const time = new Date(envelope.ts).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <div
      className={[
        'flex w-full animate-fade-in-up',
        isFromMe ? 'justify-end' : 'justify-start',
      ].join(' ')}
    >
      <div
        className={[
          'relative max-w-[80%] px-4 py-2.5 text-[15px] leading-relaxed',
          isFromMe
            ? 'bubble-mine font-medium'
            : 'bubble-theirs',
        ].join(' ')}
      >
        {/* Message text */}
        <div className="whitespace-pre-wrap break-words">
          {plaintext}
        </div>

        {/* Timestamp and status */}
        <div className={[
          'mt-1.5 flex items-center gap-2 text-[11px]',
          isFromMe ? 'justify-end text-black/60' : 'justify-end text-fg-muted',
        ].join(' ')}>
          <span>{time}</span>
          {isFromMe && deliveryState && (
            <span className="font-medium">
              {deliveryState === 'sending' && (
                <span className="opacity-60">●●●</span>
              )}
              {deliveryState === 'sent' && (
                <span>✓</span>
              )}
              {deliveryState === 'delivered' && (
                <span>✓✓</span>
              )}
              {deliveryState === 'failed' && (
                <span className="text-red-400">!</span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
