import { Link } from 'react-router'
import { CalendarDays, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { startOfWeek } from 'date-fns'
import { EmptyState } from '@/components/ui/EmptyState'
import { useCompletedWorkouts } from '@/data/hooks'
import type { WithId, Workout } from '@/domain/types'
import { formatDuration, formatShortDate, toDateKey } from '@/lib/dates'
import { formatKg } from '@/lib/formatSet'

export function HistoryScreen() {
  const { t } = useTranslation(['history', 'common'])
  const workouts = useCompletedWorkouts(200)

  if (workouts === undefined) {
    return <p className="px-4 pt-10 text-center text-ink-3">{t('common:loading')}</p>
  }

  const groups = groupByWeek(workouts)

  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('history:title')}</h1>

      {workouts.length === 0 ? (
        <EmptyState icon={CalendarDays} title={t('history:empty')} />
      ) : (
        groups.map(([weekKey, items]) => (
          <section key={weekKey}>
            <h2 className="pb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
              {t('history:week', { date: formatShortDate(new Date(weekKey)) })}
            </h2>
            <div className="flex flex-col gap-2">
              {items.map((w) => (
                <WorkoutRow key={w.id} workout={w} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function WorkoutRow({ workout }: { workout: WithId<Workout> }) {
  const { t } = useTranslation('common')

  return (
    <Link
      to={`/historial/${workout.id}`}
      className="flex items-center justify-between gap-3 rounded-card border border-hairline bg-surface p-3 active:bg-surface-2"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{workout.name}</span>
          {(workout.prCount ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 rounded-chip bg-status-warn/15 px-1.5 py-0.5 text-xs font-semibold text-status-warn">
              <Trophy className="size-3" />
              {workout.prCount}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-ink-3">
          {formatShortDate(new Date(workout.dateKey))}
          {workout.durationSeconds != null && ` · ${formatDuration(workout.durationSeconds)}`}
        </p>
      </div>
      <div className="shrink-0 text-right text-xs text-ink-2">
        <div className="tnum">{t('stats.sets', { count: workout.totalSets ?? 0 })}</div>
        {(workout.totalVolumeKg ?? 0) > 0 && (
          <div className="tnum mt-0.5">
            {formatKg(workout.totalVolumeKg!)} {t('units.kg')}
          </div>
        )}
      </div>
    </Link>
  )
}

function groupByWeek(workouts: WithId<Workout>[]): [string, WithId<Workout>[]][] {
  const map = new Map<string, WithId<Workout>[]>()
  for (const w of workouts) {
    const week = toDateKey(startOfWeek(new Date(w.dateKey), { weekStartsOn: 1 }))
    const list = map.get(week) ?? []
    list.push(w)
    map.set(week, list)
  }
  return [...map.entries()]
}
