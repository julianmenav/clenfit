import { useEffect, useState, type ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * Kebab (⋮) dropdown. The scrim is a real <button> closed on `pointerdown`:
 * a bare <div onClick> never receives a click from a touch tap, which used to
 * leave the invisible scrim up forever swallowing every subsequent tap.
 * Its z-index sits above the bottom nav so the whole screen is really guarded.
 */
export function KebabMenu({
  label,
  children,
}: {
  label?: string
  /** rendered inside the dropdown; use `MenuItem`. Receives `close`. */
  children: (close: () => void) => ReactNode
}) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={label ?? t('actions.more')}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="flex size-9 items-center justify-center rounded-card text-ink-3 active:bg-surface-2"
      >
        <MoreVertical className="size-5" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label={t('actions.close')}
            onPointerDown={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 top-10 z-50 w-56 overflow-hidden rounded-card border border-hairline bg-surface-2 py-1 shadow-lg"
          >
            {children(() => setOpen(false))}
          </div>
        </>
      )}
    </div>
  )
}

export function MenuItem({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm ${
        destructive ? 'text-status-over' : 'text-ink'
      } active:bg-surface`}
    >
      {icon}
      {label}
    </button>
  )
}
