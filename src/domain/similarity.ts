import type { ExerciseDef } from './types'

/**
 * Affinity between exercises for the mid-session swap (machine taken):
 * same movement pattern wins, then primary muscle.
 */
export function similarityScore(a: ExerciseDef, b: ExerciseDef): number {
  let score = 0
  if (a.movement === b.movement) score += 100
  if (a.muscle === b.muscle) score += 30
  const secA = new Set(a.secondaryMuscles ?? [])
  if ((b.secondaryMuscles ?? []).some((m) => secA.has(m))) score += 10
  if (a.equipment === b.equipment) score += 5
  if (a.measurement === b.measurement) score += 5
  return score
}

/**
 * Candidates sorted by affinity. Requires sharing at least movement
 * or primary muscle; excludes the exercise itself and retired ones.
 */
export function rankSimilar(
  target: ExerciseDef,
  candidates: ExerciseDef[],
  max = 10,
): ExerciseDef[] {
  return candidates
    .filter((c) => c.id !== target.id && !c.deprecated)
    .map((c) => ({ c, score: similarityScore(target, c) }))
    .filter(({ score }) => score >= 30)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name, 'es'))
    .slice(0, max)
    .map(({ c }) => c)
}
