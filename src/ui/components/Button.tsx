import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'solid' | 'ghost' | 'outline'
type ButtonSize = 'sm' | 'md'

export type ButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  /** 
   * Accessible label for the button. Required for icon-only buttons.
   * If not provided for a button with only icons and no children,
   * a console warning will be logged in development.
   */
  'aria-label'?: string
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'>

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium text-xs tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--color-bg) disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]'

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-10 px-4',
  md: 'h-11 px-6',
}

// Icon-only buttons need less horizontal padding
const iconOnlySizeClasses: Record<ButtonSize, string> = {
  sm: 'h-10 w-10 px-0',
  md: 'h-11 w-11 px-0',
}

function variantClasses(variant: ButtonVariant): string {
  if (variant === 'solid') {
    return 'glass-button text-white font-semibold hover:bg-white/15 hover:border-white/25'
  }

  if (variant === 'outline') {
    return 'border border-white/15 text-fg bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-(--color-accent)/30'
  }

  // ghost
  return 'text-fg-muted hover:text-fg hover:bg-white/5'
}

export function Button({
  children,
  className,
  variant = 'solid',
  size = 'md',
  leftIcon,
  rightIcon,
  'aria-label': ariaLabel,
  type = 'button',
  ...props
}: ButtonProps) {
  // Determine if this is an icon-only button
  const isIconOnly = !children && (leftIcon || rightIcon)
  
  // Warn in development if icon-only button is missing aria-label
  if (import.meta.env.DEV && isIconOnly && !ariaLabel) {
    console.warn(
      'Button: Icon-only buttons should have an aria-label for accessibility. ' +
      'Please provide an aria-label prop.'
    )
  }

  const cls = [
    baseClasses,
    isIconOnly ? iconOnlySizeClasses[size] : sizeClasses[size],
    variantClasses(variant),
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button 
      type={type} 
      className={cls} 
      aria-label={ariaLabel}
      {...props}
    >
      {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
      {children && <span>{children}</span>}
      {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
    </button>
  )
}

