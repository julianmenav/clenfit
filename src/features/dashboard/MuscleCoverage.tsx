import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { differenceInCalendarDays, subDays } from 'date-fns'
import { muscleCoverage } from '@/domain/analytics'
import type { Workout } from '@/domain/types'
import { toDateKey } from '@/lib/dates'

/** A muscle untouched for this many days is called out. */
const STALE_DAYS = 7
/** Home is a glance, not the Analytics screen: keep the list short. */
const MAX_ROWS = 6

/**
 * Sets per muscle over the last 7 days plus how long since each was last
 * worked — the "what should I train today" half of the home summary, which the
 * volume totals above it cannot answer.
 */
export function MuscleCoverage({
  workouts,
}: {
  workouts: Pick<Workout, 'dateKey' | 'setsByMuscle'>[]
}) {
  const { t } = useTranslation(['analytics', 'exercises'])

  const rows = useMemo(() => {
    const today = new Date()
    return muscleCoverage(workouts, toDateKey(subDays(today, 6)), (dateKey) =>
      // dateKey is a local 'YYYY-MM-DD'; parse as local noon so DST cannot
      // shift it across a day boundary
      differenceInCalendarDays(today, new Date(`${dateKey}T12:00`)),
    ).slice(0, MAX_ROWS)
  }, [workouts])

  if (rows.length === 0) return null
  const max = Math.max(...rows.map((r) => r.sets), 1)

  return (
    <div>
      <h3 className="pb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
        {t('analytics:coverage.title')}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {rows.map(({ muscle, sets, daysSince }) => {
          const stale = daysSince >= STALE_DAYS
          return (
            <li key={muscle} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 truncate text-ink-2">
                {t(`exercises:muscle.${muscle}`)}
              </span>
              <span aria-hidden className="h-1.5 min-w-0 flex-1 rounded-full bg-surface-2">
                <span
                  className={`block h-full rounded-full ${stale ? 'bg-status-warn' : 'bg-accent'}`}
                  style={{ width: `${(sets / max) * 100}%` }}
                />
              </span>
              <span className="tnum w-12 shrink-0 text-right text-ink-3">
                {t('analytics:coverage.sets', { count: sets })}
              </span>
              <span
                className={`tnum flex w-16 shrink-0 items-center justify-end gap-0.5 ${
                  stale ? 'font-medium text-status-warn' : 'text-ink-3'
                }`}
              >
                {stale && <AlertTriangle className="size-3" />}
                {daysSince === 0
                  ? t('analytics:coverage.today')
                  : t('analytics:coverage.daysAgo', { count: daysSince })}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
