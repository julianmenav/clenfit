import type { ExerciseDef, SetEntry, Workout, WorkoutExercise } from './types'

/** Does this set count toward metrics? Warmups are excluded from everything. */
export function isWorkingSet(set: SetEntry): boolean {
  return set.completed && set.type !== 'warmup'
}

/** Catalog rule for `WorkoutExercise.usesBodyweight`. */
export function defUsesBodyweight(def: Pick<ExerciseDef, 'equipment' | 'measurement'>): boolean {
  return def.equipment === 'bodyweight' && def.measurement === 'reps_only'
}

/**
 * Volume of a set (kg × reps). 0 if it doesn't count or isn't weight-based.
 * `bodyWeightKg` substitutes the load only when the set has no explicit weight.
 */
export function setVolume(set: SetEntry, bodyWeightKg?: number | null): number {
  if (!isWorkingSet(set)) return 0
  const weight = set.weightKg ?? bodyWeightKg ?? null
  if (weight == null || set.reps == null) return 0
  return weight * set.reps
}

export function exerciseVolume(exercise: WorkoutExercise, bodyWeightKg?: number | null): number {
  const bw = exercise.usesBodyweight ? (bodyWeightKg ?? null) : null
  return exercise.sets.reduce((sum, s) => sum + setVolume(s, bw), 0)
}

export function workoutVolume(
  workout: Pick<Workout, 'exercises'> & { bodyWeightKg?: number | null },
): number {
  return workout.exercises.reduce((sum, ex) => sum + exerciseVolume(ex, workout.bodyWeightKg), 0)
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
