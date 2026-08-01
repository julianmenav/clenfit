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

/* --------------------------- Sets per muscle ------------------------------ */

/** A set for a secondary muscle counts half a direct one. */
export const INDIRECT_SET_WEIGHT = 0.5

export interface MuscleSetBreakdown {
  /** Working sets where the muscle is the exercise's primary one. */
  direct: number
  /** Working sets where it appears as secondary, weighted by INDIRECT_SET_WEIGHT. */
  indirect: number
  /** Top contributors (direct + weighted indirect), descending. */
  topExercises: { exerciseId: string; exerciseName: string; sets: number }[]
}

/**
 * Direct/indirect working sets per muscle. Secondary muscles live in the
 * catalog, not in the workout doc, so the resolver is injected (keeps this
 * module pure and covers custom + deprecated exercises via the index).
 */
export function muscleSetBreakdown(
  workouts: Pick<Workout, 'exercises'>[],
  secondariesOf: (exerciseId: string) => readonly MuscleGroup[],
  topN = 3,
): Map<MuscleGroup, MuscleSetBreakdown> {
  const acc = new Map<
    MuscleGroup,
    { direct: number; indirect: number; byExercise: Map<string, { name: string; sets: number }> }
  >()

  function bucket(muscle: MuscleGroup) {
    let b = acc.get(muscle)
    if (!b) {
      b = { direct: 0, indirect: 0, byExercise: new Map() }
      acc.set(muscle, b)
    }
    return b
  }

  function credit(muscle: MuscleGroup, ex: { exerciseId: string; exerciseName: string }, sets: number, direct: boolean) {
    const b = bucket(muscle)
    if (direct) b.direct += sets
    else b.indirect += sets
    const entry = b.byExercise.get(ex.exerciseId) ?? { name: ex.exerciseName, sets: 0 }
    entry.sets += sets
    b.byExercise.set(ex.exerciseId, entry)
  }

  for (const w of workouts) {
    for (const ex of w.exercises) {
      const n = ex.sets.filter(isWorkingSet).length
      if (n === 0) continue
      credit(ex.muscle, ex, n, true)
      for (const m of secondariesOf(ex.exerciseId)) {
        if (m === ex.muscle) continue
        credit(m, ex, n * INDIRECT_SET_WEIGHT, false)
      }
    }
  }

  const out = new Map<MuscleGroup, MuscleSetBreakdown>()
  for (const [muscle, b] of acc) {
    const topExercises = [...b.byExercise.entries()]
      .map(([exerciseId, { name, sets }]) => ({ exerciseId, exerciseName: name, sets }))
      .sort((a, z) => z.sets - a.sets || a.exerciseName.localeCompare(z.exerciseName))
      .slice(0, topN)
    out.set(muscle, { direct: b.direct, indirect: b.indirect, topExercises })
  }
  return out
}

/* ------------------------------ Time buckets ------------------------------ */

/**
 * Totals per day or per ISO-Monday week. `dateKey` is 'YYYY-MM-DD' local.
 * `weekStartKeyOf` is injected so this module stays date-lib-free at the UI's
 * discretion; day granularity buckets by dateKey directly.
 */
export function bucketedTotals<W extends Pick<Workout, 'dateKey'>>(
  workouts: W[],
  pick: (w: W) => number,
  granularity: 'day' | 'week',
  weekStartKeyOf: (dateKey: string) => string,
): { bucket: string; value: number }[] {
  const map = new Map<string, number>()
  for (const w of workouts) {
    const key = granularity === 'day' ? w.dateKey : weekStartKeyOf(w.dateKey)
    map.set(key, (map.get(key) ?? 0) + pick(w))
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([bucket, value]) => ({ bucket, value }))
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

/* ---------------------------- Period comparison ---------------------------- */

export interface PeriodTotals {
  workouts: number
  sets: number
  volumeKg: number
}

/**
 * Buckets workouts by dateKey: [currentStartKey, ∞) vs [prevStartKey, currentStartKey).
 * Callers pass rolling windows rather than calendar weeks — a partial calendar
 * week compared against a full one reads as a huge drop every Monday.
 */
export function comparePeriods(
  workouts: Pick<Workout, 'dateKey' | 'totalSets' | 'totalVolumeKg'>[],
  currentStartKey: string,
  prevStartKey: string,
): { current: PeriodTotals; previous: PeriodTotals } {
  const current: PeriodTotals = { workouts: 0, sets: 0, volumeKg: 0 }
  const previous: PeriodTotals = { workouts: 0, sets: 0, volumeKg: 0 }
  for (const w of workouts) {
    if (w.dateKey < prevStartKey) continue
    const bucket = w.dateKey >= currentStartKey ? current : previous
    bucket.workouts += 1
    bucket.sets += w.totalSets ?? 0
    bucket.volumeKg += w.totalVolumeKg ?? 0
  }
  return { current, previous }
}

/* ---------------------------- Muscle coverage ----------------------------- */

export interface MuscleCoverageRow {
  muscle: MuscleGroup
  /** direct working sets inside the window */
  sets: number
  /** whole days from the last session that worked it, 0 = today */
  daysSince: number
}

/**
 * What has been trained lately and what is going stale. Reads the precomputed
 * per-workout `setsByMuscle` (direct sets only), so it never walks set arrays.
 *
 * Only muscles with history appear — an empty row for every group in the
 * catalog would be noise for someone who has trained twice. `daysSinceKey` is
 * injected to keep this module date-lib-free, as in `bucketedTotals`.
 */
export function muscleCoverage(
  workouts: Pick<Workout, 'dateKey' | 'setsByMuscle'>[],
  windowStartKey: string,
  daysSinceKey: (dateKey: string) => number,
): MuscleCoverageRow[] {
  const setsInWindow = new Map<MuscleGroup, number>()
  const lastWorked = new Map<MuscleGroup, string>()

  for (const w of workouts) {
    for (const [key, count] of Object.entries(w.setsByMuscle ?? {})) {
      if (count == null || count <= 0) continue
      const muscle = key as MuscleGroup
      const seen = lastWorked.get(muscle)
      if (seen == null || w.dateKey > seen) lastWorked.set(muscle, w.dateKey)
      if (w.dateKey >= windowStartKey) {
        setsInWindow.set(muscle, (setsInWindow.get(muscle) ?? 0) + count)
      }
    }
  }

  return [...lastWorked.entries()]
    .map(([muscle, dateKey]) => ({
      muscle,
      sets: setsInWindow.get(muscle) ?? 0,
      daysSince: daysSinceKey(dateKey),
    }))
    // busiest first so the bars read as a chart; untouched muscles sink to the
    // bottom, ordered by how long they have been neglected
    .sort((a, b) => b.sets - a.sets || b.daysSince - a.daysSince)
}
