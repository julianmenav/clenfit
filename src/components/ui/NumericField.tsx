import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Touch-friendly numeric field: local state while typing (allows '60,'),
 * parsed commit on each keystroke and re-sync when the external value changes.
 * If empty and there's a ghost (last session), tapping adopts the ghost.
 * Disabled, it renders the value as plain text (no border, no ghost adoption).
 */
export function NumericField({
  value,
  format,
  parse,
  onCommit,
  ghost,
  onAdoptGhost,
  inputMode = 'decimal',
  disabled = false,
  className,
  ariaLabel,
}: {
  value: number | null
  format: (v: number) => string
  parse: (text: string) => number | null
  onCommit: (v: number | null) => void
  /** value from the last session, shown as a placeholder */
  ghost?: string
  onAdoptGhost?: () => void
  inputMode?: 'decimal' | 'numeric'
  disabled?: boolean
  className?: string
  ariaLabel?: string
}) {
  const external = value != null ? format(value) : ''
  const [text, setText] = useState(external)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(external)
  }, [external, focused])

  return (
    <input
      type="text"
      inputMode={inputMode}
      enterKeyHint="next"
      aria-label={ariaLabel}
      disabled={disabled}
      value={text}
      placeholder={ghost ?? ''}
      onFocus={(e) => {
        setFocused(true)
        if (!text && ghost && onAdoptGhost) {
          onAdoptGhost()
        } else {
          e.target.select()
        }
      }}
      onBlur={() => {
        setFocused(false)
        setText(value != null ? format(value) : '')
      }}
      onChange={(e) => {
        setText(e.target.value)
        onCommit(e.target.value.trim() === '' ? null : parse(e.target.value))
      }}
      className={cn(
        'tnum h-11 w-full rounded-card border border-hairline bg-surface-2 text-center text-base font-medium outline-none placeholder:text-ink-3/70 focus:border-accent',
        // iOS greys out disabled inputs via -webkit-text-fill-color, hence the override
        'disabled:border-transparent disabled:bg-transparent disabled:text-ink disabled:opacity-100 disabled:[-webkit-text-fill-color:var(--ink)]',
        className,
      )}
    />
  )
}
