import { countWorkingSets, isWorkingSet, setsByMuscle, setVolume, workoutVolume } from './volume'
import type { SetEntry, Workout, WorkoutExercise } from './types'

export interface WorkoutTotals {
  totalVolumeKg: number
  totalSets: number
  setsByMuscle: Record<string, number>
}

export function summarizeWorkout(workout: Pick<Workout, 'exercises'>): WorkoutTotals {
  return {
    totalVolumeKg: workoutVolume(workout),
    totalSets: countWorkingSets(workout),
    setsByMuscle: setsByMuscle(workout),
  }
}

/** The best set of the exercise in the session: most volume; if no weight, most reps or duration. */
export function bestSet(exercise: WorkoutExercise): SetEntry | undefined {
  const working = exercise.sets.filter(isWorkingSet)
  if (working.length === 0) return undefined
  return working.reduce((best, s) => (keyOf(s) > keyOf(best) ? s : best))
}

function keyOf(s: SetEntry): number {
  const vol = setVolume(s)
  if (vol > 0) return vol * 1000
  return (s.reps ?? 0) * 100 + (s.durationSeconds ?? 0)
}

/** Drops incomplete sets and exercises left empty (on finish). */
export function pruneIncomplete(exercises: WorkoutExercise[]): WorkoutExercise[] {
  return exercises
    .map((ex) => ({ ...ex, sets: ex.sets.filter((s) => s.completed) }))
    .filter((ex) => ex.sets.length > 0)
    .map((ex, i) => ({ ...ex, order: i }))
}
