import type { InputHTMLAttributes, ReactNode } from 'react'

export type InputProps = {
  label?: string
  hint?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
} & InputHTMLAttributes<HTMLInputElement>

export function Input({ id, label, hint, leftIcon, rightIcon, className, ...props }: InputProps) {
  const inputId = id ?? (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined)

  const wrapper = [
    'group relative flex items-stretch gap-2 rounded-xl border',
    'border-white/10 bg-white/5',
    'focus-within:border-(--color-accent) focus-within:ring-1 focus-within:ring-(--color-accent)',
  ].join(' ')

  const inputCls = [
    'peer flex-1 rounded-none bg-transparent px-3 py-2 text-sm font-mono text-fg outline-none',
    'placeholder:text-fg-soft font-mono',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="space-y-1.5">
      {label ? (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium uppercase tracking-[0.18em] text-fg-soft"
        >
          {label}
        </label>
      ) : null}
      <div className={wrapper}>
        {leftIcon ? (
          <span className="pl-3 text-fg-soft">{leftIcon}</span>
        ) : null}
        <input id={inputId} className={inputCls} {...props} />
        {rightIcon ? (
          <span className="pr-3 text-fg-soft">{rightIcon}</span>
        ) : null}
      </div>
      {hint ? (
        <p className="text-xs text-fg-muted" aria-live="polite">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

