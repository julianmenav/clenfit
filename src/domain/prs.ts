import { brzycki, epley } from './oneRepMax'
import { isWorkingSet, setVolume } from './volume'
import type { ExerciseStats, PrType, SetEntry, WorkoutExercise } from './types'

/** Candidate record values, by type. */
export type PrCandidates = Partial<Record<PrType, number>>

/** Candidates contributed by a single set (excluding the session record). */
export function setCandidates(set: SetEntry): PrCandidates {
  if (!isWorkingSet(set)) return {}
  const out: PrCandidates = {}
  if (set.reps != null && set.reps > 0) out.mostReps = set.reps
  if (set.weightKg != null && set.weightKg > 0) {
    out.heaviestWeightKg = set.weightKg
    if (set.reps != null && set.reps > 0) {
      out.best1RmEpley = epley(set.weightKg, set.reps)
      out.best1RmBrzycki = brzycki(set.weightKg, set.reps)
      out.bestSetVolumeKg = setVolume(set)
    }
  }
  return out
}

/** Per-type maximum across several candidates. */
export function mergeCandidates(...many: PrCandidates[]): PrCandidates {
  const out: PrCandidates = {}
  for (const c of many) {
    for (const [k, v] of Object.entries(c) as [PrType, number][]) {
      if (v != null && (out[k] == null || v > out[k])) out[k] = v
    }
  }
  return out
}

/** Candidates from all sets of an exercise in the session (includes session volume). */
export function sessionCandidates(sets: SetEntry[]): PrCandidates {
  const merged = mergeCandidates(...sets.map(setCandidates))
  const sessionVolume = sets.reduce((sum, s) => sum + setVolume(s), 0)
  if (sessionVolume > 0) merged.bestSessionVolumeKg = sessionVolume
  return merged
}

/** The slice of `ExerciseStats` the record logic needs. */
export type StatsForPrs = Pick<ExerciseStats, 'prs' | 'totalSessions'> | null | undefined

/** First-ever session of an exercise: it establishes the baseline, not records. */
export function isBaselineSession(stats: StatsForPrs): boolean {
  return stats == null || stats.totalSessions === 0
}

export function statsBaseline(stats: Pick<ExerciseStats, 'prs'> | null | undefined): PrCandidates {
  if (!stats) return {}
  const out: PrCandidates = {}
  for (const [k, rec] of Object.entries(stats.prs) as [PrType, { value: number } | undefined][]) {
    if (rec) out[k] = rec.value
  }
  return out
}

/** Record types where `candidates` strictly beats `baseline`. */
export function detectNewPrs(candidates: PrCandidates, baseline: PrCandidates): PrType[] {
  const out: PrType[] = []
  for (const [k, v] of Object.entries(candidates) as [PrType, number][]) {
    const prev = baseline[k]
    if (v != null && (prev == null || v > prev)) out.push(k)
  }
  return out
}

/**
 * Records set by a just-completed set, counting what has already been done
 * in this session (set 3 must also beat set 2, not just the history).
 * The per-session volume record is not evaluated live: only on finish.
 */
export function detectLiveSetPrs(
  set: SetEntry,
  priorSessionSets: SetEntry[],
  stats: StatsForPrs,
): PrType[] {
  if (isBaselineSession(stats)) return []
  const baseline = mergeCandidates(statsBaseline(stats), ...priorSessionSets.map(setCandidates))
  delete baseline.bestSessionVolumeKg
  const candidates = setCandidates(set)
  return detectNewPrs(candidates, baseline)
}

export interface SessionPrResult {
  newPrs: PrType[]
  prs: ExerciseStats['prs']
}

/**
 * Merges the records of a finished session into the history. On a baseline
 * session the improved values are still stored, but none count as new records.
 */
export function applySessionPrs(
  exercise: WorkoutExercise,
  stats: StatsForPrs,
  workoutId: string,
  dateKey: string,
): SessionPrResult {
  const candidates = sessionCandidates(exercise.sets)
  const improved = detectNewPrs(candidates, statsBaseline(stats))
  const prs: ExerciseStats['prs'] = { ...(stats?.prs ?? {}) }
  for (const type of improved) {
    prs[type] = { value: candidates[type]!, workoutId, dateKey }
  }
  return { newPrs: isBaselineSession(stats) ? [] : improved, prs }
}

/** Record types as shown to the user: both 1RM formulas collapse into one. */
export type PrDisplayType =
  | 'heaviestWeight'
  | 'best1Rm'
  | 'bestSetVolume'
  | 'bestSessionVolume'
  | 'mostReps'

export function prDisplayType(p: PrType): PrDisplayType {
  switch (p) {
    case 'heaviestWeightKg':
      return 'heaviestWeight'
    case 'best1RmEpley':
    case 'best1RmBrzycki':
      return 'best1Rm'
    case 'bestSetVolumeKg':
      return 'bestSetVolume'
    case 'bestSessionVolumeKg':
      return 'bestSessionVolume'
    case 'mostReps':
      return 'mostReps'
  }
}

/** Number of records as the user perceives them (1RM pair counts once). */
export function displayPrCount(prs: PrType[]): number {
  return new Set(prs.map(prDisplayType)).size
}
