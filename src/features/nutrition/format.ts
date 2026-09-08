import type { TFunction } from 'i18next'
import type { Food, FoodEntry } from '@/domain/types'
import { formatKg } from '@/lib/formatSet'

type T = TFunction<['nutrition', 'common']>

/** «1.850» — rounded, Spanish thousands separator. */
export function formatKcal(v: number): string {
  return Math.round(v).toLocaleString('es-ES')
}

/** «32,5» — one decimal max, Spanish comma. */
export function formatGrams(v: number): string {
  return (Math.round(v * 10) / 10).toString().replace('.', ',')
}

/** Amount typed by the user (grams or units): two decimals max, comma. */
export const formatAmount = formatKg

/** «1,12». */
export function formatIndex(v: number): string {
  return (Math.round(v * 100) / 100).toFixed(2).replace('.', ',')
}

/** «150 g» · «2 × huevo» · «2 ud». */
export function entryAmountLabel(
  entry: Pick<FoodEntry, 'kind' | 'amount' | 'unitLabel'>,
  t: T,
): string {
  const amount = formatAmount(entry.amount)
  if (entry.kind === 'per100g') return t('nutrition:entry.amountGrams', { amount })
  if (entry.unitLabel) return t('nutrition:entry.amountUnits', { amount, unit: entry.unitLabel })
  return t('nutrition:entry.amountUnitsBare', { amount })
}

/** «por 100 g» · «por huevo» · «por unidad». */
export function foodBaseLabel(food: Pick<Food, 'kind' | 'unitLabel'>, t: T): string {
  if (food.kind === 'per100g') return t('nutrition:library.perBase100g')
  if (food.unitLabel) return t('nutrition:library.perBaseUnit', { unit: food.unitLabel })
  return t('nutrition:library.perBaseUnitBare')
}
