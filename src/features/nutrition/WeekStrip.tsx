import type { WeekDayCell } from '@/domain/nutrition'
import { weekdayInitial } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { formatKcal } from './format'

/** Seven tappable cells: weekday initial, kcal (— when not logged), bar vs goal. */
export function WeekStrip({
  cells,
  selectedKey,
  todayKey,
  onSelect,
}: {
  cells: WeekDayCell[]
  selectedKey: string
  todayKey: string
  onSelect: (dateKey: string) => void
}) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {cells.map((cell) => {
        const ratio = cell.goalKcal > 0 ? cell.kcal / cell.goalKcal : 0
        const over = cell.logged && ratio > 1
        const future = cell.dateKey > todayKey
        const selected = cell.dateKey === selectedKey
        return (
          <button
            key={cell.dateKey}
            type="button"
            disabled={future}
            aria-pressed={selected}
            onClick={() => onSelect(cell.dateKey)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-card border px-1 py-2',
              selected ? 'border-accent bg-surface-2' : 'border-hairline bg-surface',
              future && 'opacity-40',
            )}
          >
            <span
              className={cn(
                'text-xs font-semibold',
                cell.dateKey === todayKey ? 'text-accent' : 'text-ink-3',
              )}
            >
              {weekdayInitial(cell.dateKey)}
            </span>
            <span className="tnum text-xs">{cell.logged ? formatKcal(cell.kcal) : '—'}</span>
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn('h-full rounded-full', over ? 'bg-status-over' : 'bg-accent')}
                style={{ width: `${Math.min(100, ratio * 100)}%` }}
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}
