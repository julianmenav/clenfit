import { useTranslation } from 'react-i18next'
import type { WithId, Workout } from '@/domain/types'
import { exercisePosition } from '@/domain/workoutSummary'
import { formatShortDate } from '@/lib/dates'
import { formatSet } from '@/lib/formatSet'

/**
 * One exercise's performance in a past session: date, position in the
 * session, completed sets and note. Inner content only — the parent supplies
 * the wrapper (Link, card, …).
 */
export function ExerciseSessionSummary({
  workout,
  exerciseId,
}: {
  workout: WithId<Workout>
  exerciseId: string
}) {
  const { t } = useTranslation('exercises')
  const ex = workout.exercises.find((e) => e.exerciseId === exerciseId)
  if (!ex) return null
  // Doing an exercise 1st vs 6th changes what the numbers mean, so the
  // position rides along with the date.
  const pos = exercisePosition(workout, exerciseId)

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="text-sm font-medium">{formatShortDate(new Date(workout.dateKey))}</span>
          {pos && (
            <span className="tnum shrink-0 rounded-chip bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2">
              {t('detail.position', pos)}
            </span>
          )}
        </span>
        <span className="truncate text-xs text-ink-3">{workout.name}</span>
      </div>
      <p className="tnum mt-1 text-sm text-ink-2">
        {ex.sets
          .filter((s) => s.completed)
          .map((s) => formatSet(s, ex.measurement))
          .join(' · ')}
      </p>
      {ex.notes && <p className="mt-1 text-xs italic text-ink-3">{ex.notes}</p>}
    </>
  )
}
