import type { WithId, Workout } from '@/domain/types'
import { formatShortDate } from '@/lib/dates'
import { formatSet } from '@/lib/formatSet'

/**
 * One exercise's performance in a past session: date, completed sets and note.
 * Inner content only — the parent supplies the wrapper (Link, card, …).
 */
export function ExerciseSessionSummary({
  workout,
  exerciseId,
}: {
  workout: WithId<Workout>
  exerciseId: string
}) {
  const ex = workout.exercises.find((e) => e.exerciseId === exerciseId)
  if (!ex) return null

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{formatShortDate(new Date(workout.dateKey))}</span>
        <span className="text-xs text-ink-3">{workout.name}</span>
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
