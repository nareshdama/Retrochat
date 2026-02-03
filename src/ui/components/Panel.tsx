import type { ReactNode } from 'react'

export type PanelProps = {
  title?: string
  description?: string
  children: ReactNode
  className?: string
}

export function Panel({ title, description, children, className }: PanelProps) {
  return (
    <section className={[
      'glass-panel overflow-hidden rounded-2xl p-5',
      className,
    ].filter(Boolean).join(' ')}>
      {title ? (
        <header className="mb-4 pb-3 border-b border-white/10">
          <h2 className="text-sm font-semibold tracking-wide text-(--color-accent) uppercase">
            {title}
          </h2>
          {description ? (
            <p className="mt-1.5 text-xs text-fg-muted leading-relaxed">{description}</p>
          ) : null}
        </header>
      ) : null}
      <div className="text-sm text-fg">{children}</div>
    </section>
  )
}

