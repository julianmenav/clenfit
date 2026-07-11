import { lazy, Suspense, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useExerciseIndex } from '@/data/exerciseIndex'
import { useExerciseStats, useExerciseWorkouts, useUserProfile } from '@/data/hooks'
import type { PrType } from '@/domain/types'
import { formatShortDate } from '@/lib/dates'
import { formatKg, formatSet } from '@/lib/formatSet'

// Recharts solo cuando se abre el detalle con historial
const ProgressionChart = lazy(() =>
  import('./ProgressionChart').then((m) => ({ default: m.ProgressionChart })),
)

export type ProgressionMetric = 'weight' | 'oneRm' | 'volume'

export function ExerciseDetailScreen() {
  const { exerciseId = '' } = useParams()
  const { t } = useTranslation(['exercises', 'workout', 'common'])
  const { byId } = useExerciseIndex()
  const stats = useExerciseStats(exerciseId)
  const workouts = useExerciseWorkouts(exerciseId)
  const profile = useUserProfile()
  const [metric, setMetric] = useState<ProgressionMetric>('weight')

  const def = byId.get(exerciseId)
  const name = def?.name ?? stats?.exerciseName ?? exerciseId
  const formula = profile?.settings.oneRmFormula ?? 'epley'

  const prTypes: { type: PrType; label: string; unit: string }[] = [
    { type: 'heaviestWeightKg', label: t('workout:pr.types.heaviestWeight'), unit: 'kg' },
    {
      type: formula === 'epley' ? 'best1RmEpley' : 'best1RmBrzycki',
      label: t('workout:pr.types.best1Rm'),
      unit: 'kg',
    },
    { type: 'bestSetVolumeKg', label: t('workout:pr.types.bestSetVolume'), unit: 'kg' },
    { type: 'bestSessionVolumeKg', label: t('workout:pr.types.bestSessionVolume'), unit: 'kg' },
    { type: 'mostReps', label: t('workout:pr.types.mostReps'), unit: 'reps' },
  ]
  const prs = prTypes.filter((p) => stats?.prs[p.type] != null)

  const isWeightBased = def == null || def.measurement === 'weight_reps'

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <header className="flex items-center gap-2">
        <Link
          to="/ejercicios"
          aria-label={t('common:actions.back')}
          className="flex size-10 items-center justify-center rounded-card text-ink-2 active:bg-surface-2"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{name}</h1>
          {def && (
            <p className="text-xs text-ink-3">
              {t(`exercises:muscle.${def.muscle}`)} · {t(`exercises:equipment.${def.equipment}`)}
              {def.custom ? ` · ${t('exercises:customBadge')}` : ''}
            </p>
          )}
        </div>
      </header>

      {stats === null || (stats && stats.totalSessions === 0) ? (
        <p className="rounded-card border border-dashed border-hairline p-6 text-center text-sm text-ink-2">
          {t('exercises:detail.noHistory')}
        </p>
      ) : stats === undefined || workouts === undefined ? (
        <p className="py-6 text-center text-ink-3">{t('common:loading')}</p>
      ) : (
        <>
          {prs.length > 0 && (
            <section>
              <h2 className="flex items-center gap-1.5 pb-2 font-semibold">
                <Trophy className="size-4 text-status-warn" />
                {t('exercises:detail.prs')}
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {prs.map(({ type, label, unit }) => {
                  const rec = stats.prs[type]!
                  return (
                    <div key={type} className="rounded-card border border-hairline bg-surface p-3">
                      <div className="tnum text-lg font-bold">
                        {unit === 'kg' ? formatKg(rec.value) : rec.value} {unit}
                      </div>
                      <div className="text-xs text-ink-3">{label}</div>
                      <div className="mt-0.5 text-xs text-ink-3">
                        {formatShortDate(new Date(rec.dateKey))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {isWeightBased && workouts.length > 1 && (
            <section>
              <div className="flex items-center justify-between pb-2">
                <h2 className="font-semibold">{t('exercises:detail.progression')}</h2>
                <div className="flex gap-1 rounded-chip bg-surface-2 p-0.5">
                  {(['weight', 'oneRm', 'volume'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetric(m)}
                      className={`rounded-chip px-2.5 py-1 text-xs font-medium ${
                        metric === m ? 'bg-surface text-ink' : 'text-ink-3'
                      }`}
                    >
                      {t(`exercises:detail.metric.${m}`)}
                    </button>
                  ))}
                </div>
              </div>
              <Suspense fallback={<div className="h-48" />}>
                <ProgressionChart
                  workouts={workouts}
                  exerciseId={exerciseId}
                  metric={metric}
                  formula={formula}
                />
              </Suspense>
            </section>
          )}

          <section>
            <h2 className="pb-2 font-semibold">
              {t('exercises:detail.history')}{' '}
              <span className="text-sm font-normal text-ink-3">
                {t('exercises:detail.sessions', { count: stats.totalSessions })}
              </span>
            </h2>
            <div className="flex flex-col gap-2">
              {workouts.map((w) => {
                const ex = w.exercises.find((e) => e.exerciseId === exerciseId)
                if (!ex) return null
                return (
                  <Link
                    key={w.id}
                    to={`/historial/${w.id}`}
                    className="rounded-card border border-hairline bg-surface p-3 active:bg-surface-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {formatShortDate(new Date(w.dateKey))}
                      </span>
                      <span className="text-xs text-ink-3">{w.name}</span>
                    </div>
                    <p className="tnum mt-1 text-sm text-ink-2">
                      {ex.sets
                        .filter((s) => s.completed)
                        .map((s) => formatSet(s, ex.measurement))
                        .join(' · ')}
                    </p>
                  </Link>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

