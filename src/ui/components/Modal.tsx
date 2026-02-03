import { useEffect, useRef, useCallback, type ReactNode, type KeyboardEvent } from 'react'

export type ModalProps = {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Optional description for screen readers */
  description?: string
}

// Selectors for focusable elements
const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function Modal({ title, open, onClose, children, description }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Get all focusable elements within the modal
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!modalRef.current) return []
    return Array.from(modalRef.current.querySelectorAll(FOCUSABLE_SELECTORS))
  }, [])

  // Handle focus trap
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      onClose()
      return
    }

    if (e.key !== 'Tab') return

    const focusableElements = getFocusableElements()
    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    // Shift + Tab on first element -> focus last element
    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault()
      lastElement.focus()
    }
    // Tab on last element -> focus first element
    else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault()
      firstElement.focus()
    }
  }, [getFocusableElements, onClose])

  // Store previous focus and set initial focus when modal opens
  useEffect(() => {
    if (open) {
      // Store the currently focused element
      previousFocusRef.current = document.activeElement as HTMLElement

      // Focus the first focusable element in the modal after a brief delay
      // to ensure the modal is rendered
      const timer = setTimeout(() => {
        const focusableElements = getFocusableElements()
        if (focusableElements.length > 0) {
          focusableElements[0].focus()
        } else {
          // If no focusable elements, focus the modal itself
          modalRef.current?.focus()
        }
      }, 0)

      return () => clearTimeout(timer)
    } else {
      // Restore focus when modal closes
      if (previousFocusRef.current) {
        previousFocusRef.current.focus()
        previousFocusRef.current = null
      }
    }
  }, [open, getFocusableElements])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-description' : undefined}
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="glass-panel w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 text-fg animate-slide-up sm:animate-fade-in-up max-h-[85vh] overflow-y-auto focus:outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Drag handle for mobile */}
        <div className="sm:hidden flex justify-center mb-3">
          <div className="w-10 h-1 rounded-full bg-white/20" aria-hidden="true" />
        </div>

        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 id="modal-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-full bg-white/10 text-fg-muted flex items-center justify-center hover:bg-white/15 transition-colors focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>
        {description && (
          <p id="modal-description" className="sr-only">
            {description}
          </p>
        )}
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  )
}
