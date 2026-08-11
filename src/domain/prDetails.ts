import { displayPrCount, prDisplayType, type PrDisplayType } from './prs'
import type { OneRmFormula, PrDetail, PrType } from './types'

/**
 * Replaces the recomputed exercises' entries with freshly attributed events.
 * Entries of exercises outside the recompute are preserved untouched.
 */
export function mergePrDetails(
  current: PrDetail[],
  recomputedExerciseIds: ReadonlySet<string>,
  events: PrDetail[],
): PrDetail[] {
  return [...current.filter((d) => !recomputedExerciseIds.has(d.exerciseId)), ...events]
}

/** prCount as stored on the workout: per exercise, the 1RM pair counts once. */
export function countPrDetails(details: PrDetail[]): number {
  const byExercise = new Map<string, PrType[]>()
  for (const d of details) {
    byExercise.set(d.exerciseId, [...(byExercise.get(d.exerciseId) ?? []), d.type])
  }
  let count = 0
  for (const types of byExercise.values()) count += displayPrCount(types)
  return count
}

export interface PrDisplayRow {
  display: PrDisplayType
  value: number
  previousValue: number | null
}

export interface PrExerciseGroup {
  exerciseId: string
  exerciseName: string
  rows: PrDisplayRow[]
}

/**
 * Groups details per exercise (insertion order) and collapses the 1RM pair to
 * the user's formula; if only the other formula improved, that one is shown.
 */
export function prDisplayGroups(details: PrDetail[], formula: OneRmFormula): PrExerciseGroup[] {
  const order: string[] = []
  const byExercise = new Map<string, PrDetail[]>()
  for (const d of details) {
    if (!byExercise.has(d.exerciseId)) {
      byExercise.set(d.exerciseId, [])
      order.push(d.exerciseId)
    }
    byExercise.get(d.exerciseId)!.push(d)
  }
  const preferred1Rm: PrType = formula === 'epley' ? 'best1RmEpley' : 'best1RmBrzycki'
  return order.map((exerciseId) => {
    const list = byExercise.get(exerciseId)!
    const displays = [...new Set(list.map((d) => prDisplayType(d.type)))]
    const rows = displays.map((display) => {
      const matching = list.filter((d) => prDisplayType(d.type) === display)
      const chosen = matching.find((d) => d.type === preferred1Rm) ?? matching[0]
      return { display, value: chosen.value, previousValue: chosen.previousValue }
    })
    return { exerciseId, exerciseName: list[0].exerciseName, rows }
  })
}
