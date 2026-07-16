import { Link } from 'react-router'
import { ChevronRight, Play, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { startOfWeek } from 'date-fns'
import { useCompletedWorkouts, useRoutines } from '@/data/hooks'
import { toDateKey } from '@/lib/dates'
import { formatKg } from '@/lib/formatSet'
import { useActiveWorkoutStore } from '@/store/activeWorkout'
import { useStartWorkout } from '@/features/workout/useStartWorkout'
import type { Routine, WithId } from '@/domain/types'

export function HomeScreen() {
  const { t } = useTranslation(['common', 'routines'])
  const active = useActiveWorkoutStore((s) => s.workout)
  const { startAndGo } = useStartWorkout()
  const routines = useRoutines()
  const recent = useCompletedWorkouts(60)

  const weekStart = toDateKey(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const week = (recent ?? []).filter((w) => w.dateKey >= weekStart)
  const weekSets = week.reduce((n, w) => n + (w.totalSets ?? 0), 0)
  const weekVolume = week.reduce((n, w) => n + (w.totalVolumeKg ?? 0), 0)

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

      <section>
        <h2 className="pb-2 font-semibold">{t('common:home.thisWeek')}</h2>
        {recent !== undefined && week.length === 0 ? (
          <p className="rounded-card border border-dashed border-hairline p-4 text-sm text-ink-2">
            {t('common:home.noWorkoutsYet')}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <Stat
              value={String(week.length)}
              label={t('common:stats.workouts', { count: week.length })}
            />
            <Stat value={String(weekSets)} label={t('common:stats.sets', { count: weekSets })} />
            <Stat
              value={`${formatKg(weekVolume)}`}
              label={`${t('common:stats.volume')} (${t('common:units.kg')})`}
            />
          </div>
        )}
      </section>
    </div>
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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-card border border-hairline bg-surface px-3 py-3 text-center">
      <div className="tnum text-xl font-bold">{value}</div>
      <div className="mt-0.5 text-xs text-ink-3">{label}</div>
    </div>
  )
}
