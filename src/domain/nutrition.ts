/**
 * Nutrition math. Pure: no Firebase, no dates. Only kcal is mandatory; the
 * other components are `null` when not tracked and stay null through scaling.
 */
import { makeEntry, normalize, searchEntries } from './search'
import type { Food, FoodEntry, Macros, NutritionDay } from './types'

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

/* ------------------------------- Week view -------------------------------- */

export interface WeekDayCell {
  dateKey: string
  /** Has a day doc with at least one entry. */
  logged: boolean
  kcal: number
  protein: number | null
  /** The day's snapshotted goal, or the current one when never logged. */
  goalKcal: number
}

export interface WeekSummary {
  days: WeekDayCell[]
  /** Averages over logged days; null when nothing is logged. */
  avg: Macros | null
  /** Σ (kcal − goalKcal) over logged days. Negative = under the goal. */
  balanceKcal: number
  loggedDays: number
}

/** `dateKeys` are the seven Mon–Sun keys (built by the caller, see lib/dates weekDayKeys). */
export function weekSummary(
  dateKeys: readonly string[],
  days: readonly NutritionDay[],
  currentGoal: Macros,
): WeekSummary {
  const byKey = new Map(days.map((d) => [d.dateKey, d]))
  const cells: WeekDayCell[] = []
  const loggedTotals: Macros[] = []
  let balanceKcal = 0

  for (const dateKey of dateKeys) {
    const day = byKey.get(dateKey)
    const logged = day != null && day.entries.length > 0
    const totals = logged ? dayTotals(day.entries) : EMPTY_MACROS
    const goalKcal = day?.goal.kcal ?? currentGoal.kcal
    if (logged) {
      loggedTotals.push(totals)
      balanceKcal += totals.kcal - goalKcal
    }
    cells.push({ dateKey, logged, kcal: totals.kcal, protein: totals.protein, goalKcal })
  }

  const n = loggedTotals.length
  return {
    days: cells,
    avg: n === 0 ? null : scaleMacros(sumMacros(loggedTotals), 1 / n),
    balanceKcal,
    loggedDays: n,
  }
}

/**
 * Goal to stamp on a day write: today and the future follow the current goal;
 * a past day keeps the snapshot it was logged under (current goal if it was
 * never logged). Changing the goal in settings never recolors past weeks.
 */
export function goalForDay(
  day: Pick<NutritionDay, 'goal'> | null,
  dateKey: string,
  todayKey: string,
  currentGoal: Macros,
): Macros {
  if (dateKey >= todayKey || day == null) return currentGoal
  return day.goal
}

/* ------------------------------ Food library ------------------------------ */

/**
 * Library search. Empty query → most recently used first (then most used,
 * then name); otherwise the catalog's accent-insensitive relevance ranking.
 */
export function rankFoods<F extends Pick<Food, 'name' | 'lastUsedAt' | 'useCount'>>(
  foods: readonly F[],
  query: string,
): F[] {
  if (normalize(query) === '') {
    return [...foods].sort(
      (a, b) =>
        (b.lastUsedAt?.toMillis() ?? 0) - (a.lastUsedAt?.toMillis() ?? 0) ||
        b.useCount - a.useCount ||
        a.name.localeCompare(b.name, 'es'),
    )
  }
  return searchEntries(
    query,
    foods.map((f) => makeEntry(f, f.name)),
  )
}

/** Library food built from a freshly typed entry (the «save to my foods» checkbox). */
export function foodFromEntry(entry: FoodEntry): Omit<Food, 'createdAt' | 'lastUsedAt'> {
  return {
    name: entry.name.trim(),
    kind: entry.kind,
    unitLabel: entry.kind === 'perUnit' ? entry.unitLabel : null,
    per: entry.per,
    lastAmount: entry.amount,
    useCount: 1,
  }
}
