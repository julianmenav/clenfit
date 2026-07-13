import { isWorkingSet } from './volume'
import type { MuscleGroup, Workout } from './types'

/* ------------------------------- Rep ranges ------------------------------- */

export type RepRange = 'strength' | 'hypertrophy' | 'endurance'

export function repRangeOf(reps: number): RepRange {
  if (reps <= 5) return 'strength'
  if (reps <= 12) return 'hypertrophy'
  return 'endurance'
}

/** Working sets with reps, bucketed by rep range. */
export function repRangeDistribution(
  workouts: Pick<Workout, 'exercises'>[],
): Record<RepRange, number> {
  const out: Record<RepRange, number> = { strength: 0, hypertrophy: 0, endurance: 0 }
  for (const w of workouts) {
    for (const ex of w.exercises) {
      for (const set of ex.sets) {
        if (!isWorkingSet(set) || set.reps == null || set.reps <= 0) continue
        out[repRangeOf(set.reps)] += 1
      }
    }
  }
  return out
}

/* ----------------------------- Muscle balance ----------------------------- */

export type BalanceGroup = 'push' | 'pull' | 'legs' | 'core'

const balanceGroups: Record<MuscleGroup, BalanceGroup | null> = {
  chest: 'push',
  shoulders: 'push',
  triceps: 'push',
  back: 'pull',
  biceps: 'pull',
  forearms: 'pull',
  quads: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  core: 'core',
  cardio: null,
}

export function balanceGroupOf(muscle: MuscleGroup): BalanceGroup | null {
  return balanceGroups[muscle]
}

/** Aggregates the precomputed per-workout `setsByMuscle` into balance groups. */
export function muscleBalance(
  workouts: Pick<Workout, 'setsByMuscle'>[],
): Record<BalanceGroup, number> {
  const out: Record<BalanceGroup, number> = { push: 0, pull: 0, legs: 0, core: 0 }
  for (const w of workouts) {
    for (const [muscle, sets] of Object.entries(w.setsByMuscle ?? {})) {
      const group = balanceGroupOf(muscle as MuscleGroup)
      if (group != null) out[group] += sets ?? 0
    }
  }
  return out
}

/* ------------------------------- PR markers ------------------------------- */

/** true where values[i] strictly exceeds every previous value; index 0 is never a PR. */
export function runningMaxFlags(values: number[]): boolean[] {
  let max = -Infinity
  return values.map((v, i) => {
    const isPr = i > 0 && v > max
    if (v > max) max = v
    return isPr
  })
}

/* ----------------------------- Week comparison ---------------------------- */

export interface WeekTotals {
  workouts: number
  sets: number
  volumeKg: number
}

/** Buckets workouts by dateKey: [currentStartKey, ∞) vs [prevStartKey, currentStartKey). */
export function compareWeeks(
  workouts: Pick<Workout, 'dateKey' | 'totalSets' | 'totalVolumeKg'>[],
  currentStartKey: string,
  prevStartKey: string,
): { current: WeekTotals; previous: WeekTotals } {
  const current: WeekTotals = { workouts: 0, sets: 0, volumeKg: 0 }
  const previous: WeekTotals = { workouts: 0, sets: 0, volumeKg: 0 }
  for (const w of workouts) {
    if (w.dateKey < prevStartKey) continue
    const bucket = w.dateKey >= currentStartKey ? current : previous
    bucket.workouts += 1
    bucket.sets += w.totalSets ?? 0
    bucket.volumeKg += w.totalVolumeKg ?? 0
  }
  return { current, previous }
}
