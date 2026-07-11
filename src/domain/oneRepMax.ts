import type { OneRmFormula, SetEntry } from './types'

/** Epley: standard in Strong/Hevy. Exact at reps = 1. */
export function epley(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg
  return weightKg * (1 + reps / 30)
}

/** Brzycki: more accurate at low reps. Diverges near 37 reps: clamped. */
export function brzycki(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg
  const r = Math.min(reps, 30)
  return (weightKg * 36) / (37 - r)
}

export function oneRm(weightKg: number, reps: number, formula: OneRmFormula): number {
  return formula === 'epley' ? epley(weightKg, reps) : brzycki(weightKg, reps)
}

/**
 * Estimated 1RM of a set. undefined if not applicable: warmups,
 * incomplete sets or without weight/reps (only weight-and-reps exercises).
 */
export function estimateSet1Rm(set: SetEntry, formula: OneRmFormula): number | undefined {
  if (!set.completed || set.type === 'warmup') return undefined
  if (set.weightKg == null || set.reps == null || set.reps <= 0 || set.weightKg <= 0)
    return undefined
  return oneRm(set.weightKg, set.reps, formula)
}
