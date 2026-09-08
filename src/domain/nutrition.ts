/**
 * Nutrition math. Pure: no Firebase, no dates. Only kcal is mandatory; the
 * other components are `null` when not tracked and stay null through scaling.
 */
import type { FoodEntry, Macros } from './types'

export const EMPTY_MACROS: Macros = { kcal: 0, protein: null, carbs: null, fat: null }

const optionalKeys = ['protein', 'carbs', 'fat'] as const

export function scaleMacros(m: Macros, factor: number): Macros {
  return {
    kcal: m.kcal * factor,
    protein: m.protein == null ? null : m.protein * factor,
    carbs: m.carbs == null ? null : m.carbs * factor,
    fat: m.fat == null ? null : m.fat * factor,
  }
}

/** Macros of a logged entry: per 100 g × grams/100, or per unit × units. */
export function entryMacros(entry: Pick<FoodEntry, 'kind' | 'amount' | 'per'>): Macros {
  return scaleMacros(entry.per, entry.kind === 'per100g' ? entry.amount / 100 : entry.amount)
}

/** kcal always summed; an optional component is null only when every input has it null. */
export function sumMacros(list: readonly Macros[]): Macros {
  const out: Macros = { ...EMPTY_MACROS }
  for (const m of list) {
    out.kcal += m.kcal
    for (const k of optionalKeys) {
      const v = m[k]
      if (v != null) out[k] = (out[k] ?? 0) + v
    }
  }
  return out
}

export function dayTotals(entries: readonly FoodEntry[]): Macros {
  return sumMacros(entries.map(entryMacros))
}

/**
 * Protein density relative to the goal: (protein/goalProtein) / (kcal/goalKcal).
 * 1 = exactly the goal's ratio; 2 = twice as protein-dense. null when protein
 * is unknown on either side or there are no kcal to compare.
 */
export function proteinIndex(m: Macros, goal: Macros): number | null {
  if (m.protein == null || goal.protein == null) return null
  if (goal.protein <= 0 || goal.kcal <= 0 || m.kcal <= 0) return null
  return m.protein / goal.protein / (m.kcal / goal.kcal)
}

/** goal − eaten per component; null where the goal has no target. Negative = over. */
export function remaining(goal: Macros, eaten: Macros): Macros {
  return {
    kcal: goal.kcal - eaten.kcal,
    protein: goal.protein == null ? null : goal.protein - (eaten.protein ?? 0),
    carbs: goal.carbs == null ? null : goal.carbs - (eaten.carbs ?? 0),
    fat: goal.fat == null ? null : goal.fat - (eaten.fat ?? 0),
  }
}

/** A goal is usable once it has calories (settings may hold a half-typed goal). */
export function hasGoal(goal: Macros | null | undefined): goal is Macros {
  return goal != null && goal.kcal > 0
}
