import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAllExerciseStats, useUserProfile } from '@/data/hooks'
import type { WithId, Workout } from '@/domain/types'
import { ProgressionChart } from '@/features/exercises/ProgressionChart'

/** Estimated-1RM progression for a chosen exercise (only those with 1RM history). */
export function OneRmProgressionCard({
  workouts,
  fromDateKey,
}: {
  /** Full (unfiltered) completed-workouts list; the range cutoff trims display only. */
  workouts: WithId<Workout>[]
  fromDateKey?: string
}) {
  const { t } = useTranslation('analytics')
  const statsMap = useAllExerciseStats()
  const profile = useUserProfile()
  const formula = profile?.settings.oneRmFormula ?? 'epley'

  const eligible = useMemo(() => {
    if (!statsMap) return []
    return [...statsMap.values()]
      .filter((s) => s.prs.best1RmEpley != null)
      .sort((a, b) => b.updatedAt.seconds - a.updatedAt.seconds)
  }, [statsMap])

  const [selected, setSelected] = useState<string | null>(null)
  const exerciseId = selected ?? eligible[0]?.exerciseId

  const exerciseWorkouts = useMemo(
    () => (exerciseId ? workouts.filter((w) => w.exerciseIds.includes(exerciseId)) : []),
    [workouts, exerciseId],
  )

  const inRange = useMemo(
    () =>
      fromDateKey == null
        ? exerciseWorkouts
        : exerciseWorkouts.filter((w) => w.dateKey >= fromDateKey),
    [exerciseWorkouts, fromDateKey],
  )

  return (
    <section className="rounded-card border border-hairline bg-surface p-3">
      <div className="flex items-center justify-between gap-3 pb-2">
        <h2 className="font-semibold">{t('oneRm.title')}</h2>
        {eligible.length > 0 && (
          <select
            aria-label={t('oneRm.exercise')}
            value={exerciseId}
            onChange={(e) => setSelected(e.target.value)}
            className="h-9 max-w-[55%] truncate rounded-card border border-hairline bg-surface-2 px-2 text-sm text-ink"
          >
            {eligible.map((s) => (
              <option key={s.exerciseId} value={s.exerciseId}>
                {s.exerciseName}
              </option>
            ))}
          </select>
        )}
      </div>

      {exerciseId == null || inRange.length < 2 ? (
        <p className="py-4 text-center text-sm text-ink-3">{t('oneRm.empty')}</p>
      ) : (
        <ProgressionChart
          workouts={exerciseWorkouts}
          exerciseId={exerciseId}
          metric="oneRm"
          formula={formula}
          fromDateKey={fromDateKey}
        />
      )}
    </section>
  )
}
