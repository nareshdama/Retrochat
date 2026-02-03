import type { ReactNode } from 'react'

export type ToastProps = {
  kind?: 'info' | 'success' | 'warning'
  children: ReactNode
}

export function Toast({ kind = 'info', children }: ToastProps) {
  const border =
    kind === 'success'
      ? 'border-white/80'
      : kind === 'warning'
        ? 'border-white/60'
        : 'border-white/40'

  return (
    <div
      role="status"
      className={[
        'inline-flex items-center gap-2 rounded-full border bg-(--color-accent-soft)/80 px-3 py-1.5 text-xs text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.06)]',
        border,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-fg" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}

