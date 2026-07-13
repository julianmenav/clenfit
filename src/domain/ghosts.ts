import type { SetEntry } from './types'

/**
 * Ghost (placeholder) for set `setIndex`: the index-aligned set from the last
 * session, or a weight-only fallback taken from the nearest earlier set of the
 * current session with a weight typed in. The fallback deliberately carries no
 * reps/duration: weight tends to hold across working sets, reps do not.
 */
export function ghostForSet(
  currentSets: SetEntry[],
  setIndex: number,
  lastSets: SetEntry[] | null | undefined,
): SetEntry | undefined {
  const fromHistory = lastSets?.[setIndex]
  if (fromHistory) return fromHistory
  for (let i = setIndex - 1; i >= 0; i--) {
    const weightKg = currentSets[i]?.weightKg
    if (weightKg != null) {
      return {
        order: setIndex,
        type: 'normal',
        weightKg,
        reps: null,
        durationSeconds: null,
        distanceMeters: null,
        rpe: null,
        completed: false,
      }
    }
  }
  return undefined
}
