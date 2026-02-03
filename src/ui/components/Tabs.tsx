import { useCallback, useRef, type ReactNode, type KeyboardEvent } from 'react'
import { useId, useState } from 'react'

export type TabItem = {
  id: string
  label: string
  content: ReactNode
}

export type TabsProps = {
  items: TabItem[]
  initialId?: string
  /** Accessible label for the tab list */
  ariaLabel?: string
}

export function Tabs({ items, initialId, ariaLabel = 'Tab navigation' }: TabsProps) {
  const [activeId, setActiveId] = useState<string>(initialId ?? items[0]?.id ?? '')
  const tablistId = useId()
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const active = items.find((t) => t.id === activeId) ?? items[0]

  // Get the index of the currently active tab
  const getActiveIndex = useCallback(() => {
    return items.findIndex((t) => t.id === activeId)
  }, [items, activeId])

  // Focus a tab by index
  const focusTab = useCallback((index: number) => {
    const tab = items[index]
    if (tab) {
      const tabElement = tabRefs.current.get(tab.id)
      tabElement?.focus()
    }
  }, [items])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = getActiveIndex()
    let newIndex: number | null = null

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        // Move to previous tab, wrap to end if at start
        newIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1
        break
      case 'ArrowRight':
        e.preventDefault()
        // Move to next tab, wrap to start if at end
        newIndex = currentIndex >= items.length - 1 ? 0 : currentIndex + 1
        break
      case 'Home':
        e.preventDefault()
        newIndex = 0
        break
      case 'End':
        e.preventDefault()
        newIndex = items.length - 1
        break
      default:
        return
    }

    if (newIndex !== null && items[newIndex]) {
      setActiveId(items[newIndex].id)
      focusTab(newIndex)
    }
  }, [getActiveIndex, items, focusTab])

  // Store tab ref
  const setTabRef = useCallback((id: string, element: HTMLButtonElement | null) => {
    if (element) {
      tabRefs.current.set(id, element)
    } else {
      tabRefs.current.delete(id)
    }
  }, [])

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-orientation="horizontal"
        aria-label={ariaLabel}
        id={tablistId}
        className="inline-flex gap-1 rounded-full border border-border-subtle bg-(--color-bg-elevated) p-1"
        onKeyDown={handleKeyDown}
      >
        {items.map((tab) => {
          const isActive = tab.id === activeId
          return (
            <button
              key={tab.id}
              ref={(el) => setTabRef(tab.id, el)}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`${tab.id}-panel`}
              id={`${tab.id}-tab`}
              // Only the active tab should be in the tab order
              tabIndex={isActive ? 0 : -1}
              className={[
                'min-w-18 rounded-full px-3 py-1.5 text-xs font-medium outline-none transition-colors',
                isActive
                  ? 'bg-(--color-accent) text-(--color-accent-fg)'
                  : 'text-fg-soft hover:bg-(--color-accent-soft)',
                'focus-visible:ring-2 focus-visible:ring-(--color-accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--color-bg)',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setActiveId(tab.id)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {active ? (
        <div
          role="tabpanel"
          id={`${active.id}-panel`}
          aria-labelledby={`${active.id}-tab`}
          tabIndex={0}
          className="rounded-3xl border border-border-subtle bg-(--color-surface)/95 p-4 shadow-(--shadow-soft) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-accent)"
        >
          {active.content}
        </div>
      ) : null}
    </div>
  )
}

