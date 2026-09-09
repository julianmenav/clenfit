import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatWeekRange } from '@/lib/dates'

/**
 * Mon–Sun stepper on week keys. › stops at the current week; ‹ stops at
 * `minWeekStart` (null = unbounded).
 */
export function WeekPager({
  weekStart,
  currentWeekStart,
  minWeekStart,
  onStep,
  labels,
}: {
  weekStart: string
  currentWeekStart: string
  minWeekStart: string | null
  onStep: (dir: -1 | 1) => void
  labels: { current: string; prev: string; next: string }
}) {
  const isCurrent = weekStart >= currentWeekStart
  const atMin = minWeekStart != null && weekStart <= minWeekStart

  return (
    <div className="flex items-center justify-between rounded-card border border-hairline bg-surface p-1">
      <button
        type="button"
        aria-label={labels.prev}
        disabled={atMin}
        onClick={() => onStep(-1)}
        className="flex size-9 items-center justify-center rounded-card text-ink-2 active:bg-surface-2 disabled:opacity-30"
      >
        <ChevronLeft className="size-5" />
      </button>
      <span className="text-sm font-medium">
        {isCurrent ? labels.current : formatWeekRange(weekStart)}
      </span>
      <button
        type="button"
        aria-label={labels.next}
        disabled={isCurrent}
        onClick={() => onStep(1)}
        className="flex size-9 items-center justify-center rounded-card text-ink-2 active:bg-surface-2 disabled:opacity-30"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  )
}
