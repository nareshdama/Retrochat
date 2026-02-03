export type TypingIndicatorProps = {
  peerAddress: string
}

export function TypingIndicator({}: TypingIndicatorProps) {
  return (
    <div className="flex justify-start px-3">
      <div className="rounded-2xl border border-border-subtle bg-(--color-bg) px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="h-1 w-1 animate-pulse rounded-full bg-fg-soft" />
          <span className="h-1 w-1 animate-pulse rounded-full bg-fg-soft delay-75" />
          <span className="h-1 w-1 animate-pulse rounded-full bg-fg-soft delay-150" />
        </div>
      </div>
    </div>
  )
}
