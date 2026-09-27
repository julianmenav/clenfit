import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BackButton } from '@/components/ui/BackButton'
import { useExerciseIndex } from '@/data/exerciseIndex'
import { ExerciseMenu } from './ExerciseMenu'
import { useExerciseStats, useExerciseWorkouts, useUserProfile } from '@/data/hooks'
import { progressionSeries, type ProgressionMetric } from '@/domain/analytics'
import type { PrType } from '@/domain/types'
import { defUsesBodyweight } from '@/domain/volume'
import { formatShortDate } from '@/lib/dates'
import { formatKg } from '@/lib/formatSet'
import { ExerciseSessionSummary } from './ExerciseSessionSummary'

// Recharts solo cuando se abre el detalle con historial
const ProgressionChart = lazy(() =>
  import('./ProgressionChart').then((m) => ({ default: m.ProgressionChart })),
)

export function ExerciseDetailScreen() {
  const { exerciseId = '' } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation(['exercises', 'workout', 'common'])
  const { byId } = useExerciseIndex()
  const stats = useExerciseStats(exerciseId)
  const workouts = useExerciseWorkouts(exerciseId)
  const profile = useUserProfile()
  const [selectedMetric, setSelectedMetric] = useState<ProgressionMetric>('weight')

  const def = byId.get(exerciseId)
  const name = def?.name ?? stats?.exerciseName ?? exerciseId
  const formula = profile?.settings.oneRmFormula ?? 'epley'

  // on a bodyweight exercise the recorded weight is ballast, hence the '+'
  const isBodyweight = def != null && defUsesBodyweight(def)
  const loadPrefix = isBodyweight ? '+' : ''

  // only metrics with a trend to show (≥ 2 sessions with a value) get a toggle
  const availableMetrics = useMemo(
    () =>
      (['weight', 'oneRm', 'volume'] as const).filter(
        (m) => progressionSeries(workouts ?? [], exerciseId, m, formula).length >= 2,
      ),
    [workouts, exerciseId, formula],
  )
  const metric = availableMetrics.includes(selectedMetric) ? selectedMetric : availableMetrics[0]
  const metricLabel = (m: ProgressionMetric) =>
    m === 'weight' && isBodyweight
      ? t('exercises:detail.metric.ballast')
      : t(`exercises:detail.metric.${m}`)
  const prTypes: { type: PrType; label: string; unit: string; prefix?: string }[] = [
    {
      type: 'heaviestWeightKg',
      label: t('workout:pr.types.heaviestWeight'),
      unit: 'kg',
      prefix: loadPrefix,
    },
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

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <header className="flex items-center gap-2">
        <BackButton fallback="/ejercicios" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{name}</h1>
          {def && (
            <p className="text-xs text-ink-3">
              {t(`exercises:muscle.${def.muscle}`)} · {t(`exercises:equipment.${def.equipment}`)}
              {def.custom ? ` · ${t('exercises:customBadge')}` : ''}
            </p>
          )}
        </div>
        {def && <ExerciseMenu def={def} onDeleted={() => void navigate('/ejercicios')} />}
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
                {prs.map(({ type, label, unit, prefix = '' }) => {
                  const rec = stats.prs[type]!
                  return (
                    <div key={type} className="rounded-card border border-hairline bg-surface p-3">
                      <div className="tnum text-lg font-bold">
                        {prefix}
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

          {metric != null && (
            <section>
              <div className="flex items-center justify-between pb-2">
                <h2 className="font-semibold">{t('exercises:detail.progression')}</h2>
                <div className="flex gap-1 rounded-chip bg-surface-2 p-0.5">
                  {availableMetrics.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMetric(m)}
                      className={`rounded-chip px-2.5 py-1 text-xs font-medium ${
                        metric === m ? 'bg-surface text-ink' : 'text-ink-3'
                      }`}
                    >
                      {metricLabel(m)}
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
                  valuePrefix={metric === 'weight' ? loadPrefix : ''}
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
              {workouts.map((w) => (
                <Link
                  key={w.id}
                  to={`/historial/${w.id}`}
                  className="rounded-card border border-hairline bg-surface p-3 active:bg-surface-2"
                >
                  <ExerciseSessionSummary workout={w} exerciseId={exerciseId} />
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

