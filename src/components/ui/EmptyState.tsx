import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-hairline px-6 py-10 text-center">
      <Icon className="size-8 text-ink-3" />
      <p className="font-medium">{title}</p>
      {body && <p className="max-w-xs text-sm text-ink-2">{body}</p>}
      {action}
    </div>
  )
}
