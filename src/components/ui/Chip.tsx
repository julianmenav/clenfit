import { cn } from '@/lib/utils'

export function Chip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-8 shrink-0 rounded-chip border px-3 text-sm transition-colors',
        active
          ? 'border-accent bg-accent font-medium text-on-accent'
          : 'border-hairline bg-surface text-ink-2',
      )}
    >
      {label}
    </button>
  )
}
