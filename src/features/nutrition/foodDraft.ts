import type { Food, FoodKind } from '@/domain/types'

/** Editable state of the food form (new food in the add sheet, or a library edit). */
export interface FoodDraft {
  name: string
  kind: FoodKind
  /** Free text while editing; trimmed/nulled by draftToFoodFields. */
  unitLabel: string
  per: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null }
}

export function emptyFoodDraft(name = ''): FoodDraft {
  return {
    name,
    kind: 'per100g',
    unitLabel: '',
    per: { kcal: null, protein: null, carbs: null, fat: null },
  }
}

export function draftFromFood(food: Food): FoodDraft {
  return { name: food.name, kind: food.kind, unitLabel: food.unitLabel ?? '', per: { ...food.per } }
}

/** Name and kcal are the only requirements. */
export function draftIsValid(d: FoodDraft): boolean {
  return d.name.trim().length > 0 && d.per.kcal != null && d.per.kcal >= 0
}

export function draftToFoodFields(d: FoodDraft): Pick<Food, 'name' | 'kind' | 'unitLabel' | 'per'> {
  const unit = d.unitLabel.trim()
  return {
    name: d.name.trim(),
    kind: d.kind,
    unitLabel: d.kind === 'perUnit' && unit ? unit : null,
    per: { kcal: d.per.kcal ?? 0, protein: d.per.protein, carbs: d.per.carbs, fat: d.per.fat },
  }
}
