import type { SetEntry, Workout, WorkoutExercise } from './types'

/** Does this set count toward metrics? Warmups are excluded from everything. */
export function isWorkingSet(set: SetEntry): boolean {
  return set.completed && set.type !== 'warmup'
}

/** Volume of a set (kg × reps). 0 if it doesn't count or isn't weight-based. */
export function setVolume(set: SetEntry): number {
  if (!isWorkingSet(set)) return 0
  if (set.weightKg == null || set.reps == null) return 0
  return set.weightKg * set.reps
}

export function exerciseVolume(exercise: WorkoutExercise): number {
  return exercise.sets.reduce((sum, s) => sum + setVolume(s), 0)
}

export function workoutVolume(workout: Pick<Workout, 'exercises'>): number {
  return workout.exercises.reduce((sum, ex) => sum + exerciseVolume(ex), 0)
}

export function countWorkingSets(workout: Pick<Workout, 'exercises'>): number {
  return workout.exercises.reduce((sum, ex) => sum + ex.sets.filter(isWorkingSet).length, 0)
}

/** Effective sets per muscle group (only the exercise's primary muscle). */
export function setsByMuscle(workout: Pick<Workout, 'exercises'>): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const ex of workout.exercises) {
    const n = ex.sets.filter(isWorkingSet).length
    if (n > 0) acc[ex.muscle] = (acc[ex.muscle] ?? 0) + n
  }
  return acc
}
