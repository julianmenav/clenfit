import { detectNewPrs, sessionCandidates, statsBaseline } from './prs'
import type { ExerciseStats, WithId, Workout } from './types'

/** Result of rebuilding one exercise's stats from scratch (no id/updatedAt yet). */
export interface RebuiltExerciseStats {
  exerciseName: string
  lastPerformance: ExerciseStats['lastPerformance']
  prs: ExerciseStats['prs']
  totalSessions: number
}

/**
 * Chronological replay of an exercise's history. `sessions` MUST be sorted
 * ascending by startedAt so each record is attributed to the first workout
 * that reached it. Returns null if the exercise never appears.
 */
export function rebuildStatsForExercise(
  sessions: WithId<Workout>[],
  exerciseId: string,
): RebuiltExerciseStats | null {
  let prs: ExerciseStats['prs'] = {}
  let exerciseName = ''
  let last: ExerciseStats['lastPerformance'] = null
  let totalSessions = 0

  for (const w of sessions) {
    const matches = w.exercises.filter((e) => e.exerciseId === exerciseId)
    if (matches.length === 0) continue
    totalSessions += 1
    for (const ex of matches) {
      exerciseName = ex.exerciseName
      const bw = ex.usesBodyweight ? (w.bodyWeightKg ?? null) : null
      const candidates = sessionCandidates(ex.sets, bw)
      const newTypes = detectNewPrs(candidates, statsBaseline({ prs }))
      for (const type of newTypes) {
        prs = { ...prs, [type]: { value: candidates[type]!, workoutId: w.id, dateKey: w.dateKey } }
      }
      last = { workoutId: w.id, dateKey: w.dateKey, sets: ex.sets }
    }
  }

  if (totalSessions === 0) return null
  return { exerciseName, lastPerformance: last, prs, totalSessions }
}

/** Rebuilds every exercise that appears in the history (sorted ascending). */
export function rebuildAllStats(sessions: WithId<Workout>[]): Map<string, RebuiltExerciseStats> {
  const ids = new Set(sessions.flatMap((w) => w.exercises.map((e) => e.exerciseId)))
  const out = new Map<string, RebuiltExerciseStats>()
  for (const id of ids) {
    const rebuilt = rebuildStatsForExercise(sessions, id)
    if (rebuilt) out.set(id, rebuilt)
  }
  return out
}
