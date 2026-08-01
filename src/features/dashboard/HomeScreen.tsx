import { useMemo } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Play, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { startOfWeek, subWeeks } from 'date-fns'
import { useCompletedWorkouts, useRoutines } from '@/data/hooks'
import { bucketedTotals } from '@/domain/analytics'
import { toDateKey } from '@/lib/dates'
import { useActiveWorkoutStore } from '@/store/activeWorkout'
import { useStartWorkout } from '@/features/workout/useStartWorkout'
import { Last7DaysCard } from '@/features/analytics/Last7DaysCard'
import { MuscleCoverage } from './MuscleCoverage'
import type { Routine, WithId, Workout } from '@/domain/types'

export function HomeScreen() {
  const { t } = useTranslation(['common', 'routines'])
  const active = useActiveWorkoutStore((s) => s.workout)
  const { startAndGo } = useStartWorkout()
  const routines = useRoutines()
  // 100 covers 8 weeks of history for the volume strip
  const recent = useCompletedWorkouts(100)

  return (
    <div className="flex flex-col gap-6 px-4 pt-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('common:appName')}</h1>
        <Link
          to="/ajustes"
          aria-label={t('common:nav.settings')}
          className="flex size-10 items-center justify-center rounded-card text-ink-2 active:bg-surface-2 lg:hidden"
        >
          <Settings className="size-5" />
        </Link>
      </header>

      {active ? (
        <button
          type="button"
          onClick={() => startAndGo()}
          className="flex items-center justify-between rounded-card bg-accent px-5 py-4 text-left text-on-accent"
        >
          <span>
            <span className="block text-sm opacity-80">{t('common:home.inProgress')}</span>
            <span className="block text-lg font-bold">{active.name}</span>
          </span>
          <ChevronRight className="size-6" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => startAndGo()}
          className="flex h-14 items-center justify-center gap-2 rounded-card bg-accent text-lg font-bold text-on-accent transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          <Play className="size-6" strokeWidth={2.5} />
          {t('common:home.startWorkout')}
        </button>
      )}

      <section>
        <div className="flex items-center justify-between pb-2">
          <h2 className="font-semibold">{t('common:home.myRoutines')}</h2>
          <Link to="/rutinas" className="text-sm text-accent">
            {t('routines:title')}
          </Link>
        </div>
        {routines === undefined ? null : routines.length === 0 ? (
          <p className="rounded-card border border-dashed border-hairline p-4 text-sm text-ink-2">
            {t('routines:empty')}
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
            {routines.map((r) => (
              <RoutineCard key={r.id} routine={r} disabled={active != null} />
            ))}
          </div>
        )}
      </section>

      {recent !== undefined &&
        (recent.length === 0 ? (
          <p className="rounded-card border border-dashed border-hairline p-4 text-sm text-ink-2">
            {t('common:home.noWorkoutsYet')}
          </p>
        ) : (
          <>
            <Last7DaysCard workouts={recent} footer={<MuscleCoverage workouts={recent} />} />
            <EightWeekStrip workouts={recent} />
          </>
        ))}
    </div>
  )
}

/** Mini volume-per-week strip (last 8 weeks, current one accented) → /analisis. */
function EightWeekStrip({ workouts }: { workouts: WithId<Workout>[] }) {
  const { t } = useTranslation('common')

  const weeks = useMemo(() => {
    const totals = new Map(
      bucketedTotals(workouts, (w) => w.totalVolumeKg ?? 0, 'week', (dateKey) =>
        toDateKey(startOfWeek(new Date(dateKey), { weekStartsOn: 1 })),
      ).map((b) => [b.bucket, b.value]),
    )
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 8 }, (_, i) => {
      const key = toDateKey(subWeeks(monday, 7 - i))
      return { key, value: totals.get(key) ?? 0 }
    })
  }, [workouts])

  if (weeks.every((w) => w.value === 0)) return null
  const max = Math.max(...weeks.map((w) => w.value))

  return (
    <Link
      to="/analisis"
      className="block rounded-card border border-hairline bg-surface p-3 active:bg-surface-2"
    >
      <div className="flex items-center justify-between pb-2">
        <h2 className="font-semibold">{t('home.last8Weeks')}</h2>
        <ChevronRight className="size-4 text-ink-3" />
      </div>
      <div aria-hidden className="flex h-16 items-end gap-1.5">
        {weeks.map((w, i) => (
          <div
            key={w.key}
            className={`flex-1 rounded-t-[3px] ${i === 7 ? 'bg-accent' : 'bg-accent/30'}`}
            style={{ height: `${w.value > 0 ? Math.max((w.value / max) * 100, 8) : 3}%` }}
          />
        ))}
      </div>
    </Link>
  )
}

function RoutineCard({ routine, disabled }: { routine: WithId<Routine>; disabled: boolean }) {
  const { t } = useTranslation('routines')
  const { startAndGo } = useStartWorkout()

  return (
    <div className="flex w-44 shrink-0 flex-col justify-between gap-3 rounded-card border border-hairline bg-surface p-3">
      <div>
        <h3 className="truncate font-semibold">{routine.name}</h3>
        <p className="text-xs text-ink-3">
          {t('exercises', { count: routine.slots.length })}
        </p>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => startAndGo(routine)}
        className="flex h-9 items-center justify-center gap-1.5 rounded-card bg-accent text-sm font-semibold text-on-accent disabled:opacity-50"
      >
        <Play className="size-4" />
        {t('start')}
      </button>
    </div>
  )
}
