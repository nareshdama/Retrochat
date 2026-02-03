import { useState, useRef, useEffect } from 'react'

export type MessageInputProps = {
  onSend: (text: string) => Promise<void>
  disabled?: boolean
  sendDisabled?: boolean
  placeholder?: string
}

export function MessageInput({
  onSend,
  disabled,
  sendDisabled = false,
  placeholder = 'Type a message',
}: MessageInputProps) {
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const trimmed = input.trim()
    if (!trimmed || isSending || disabled || sendDisabled) {
      return
    }

    setIsSending(true)
    try {
      await onSend(trimmed)
      setInput('')
      textareaRef.current?.focus()
    } catch (err) {
      // Error handling is done by parent component
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSubmit(event)
    }
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  const canSend = input.trim() && !disabled && !isSending && !sendDisabled

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 p-2 bg-(--color-surface) rounded-2xl border border-white/5"
    >
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isSending}
        rows={1}
        className="flex-1 min-h-[40px] max-h-[120px] resize-none bg-transparent text-sm text-fg placeholder:text-fg-muted outline-none leading-relaxed py-2 px-3 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={!canSend}
        className={[
          'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200',
          canSend
            ? 'bg-gradient-to-br from-[#00796b] to-[#005c4b] text-white shadow-lg hover:opacity-90 active:scale-95'
            : 'bg-white/10 text-fg-muted',
        ].join(' ')}
      >
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </form>
  )
}
