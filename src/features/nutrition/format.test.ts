import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import type { Macros } from '@/domain/types'
import { macrosLine } from './format'

/** Stub resolver: returns the last key segment, enough to assert structure. */
const t = ((key: string) => {
  const map: Record<string, string> = {
    'common:units.kcal': 'kcal',
    'nutrition:macros.proteinLetter': 'P',
    'nutrition:macros.carbsLetter': 'H',
    'nutrition:macros.fatLetter': 'G',
  }
  return map[key] ?? key
}) as unknown as TFunction<['nutrition', 'common']>

const m = (
  kcal: number,
  protein: number | null = null,
  carbs: number | null = null,
  fat: number | null = null,
): Macros => ({ kcal, protein, carbs, fat })

describe('macrosLine', () => {
  it('lists kcal and every stored macro', () => {
    expect(macrosLine(m(165, 31, 0, 3.6), t)).toBe('165 kcal · 31 P · 0 H · 3,6 G')
  })

  it('omits the macros the food does not store', () => {
    expect(macrosLine(m(165, 31), t)).toBe('165 kcal · 31 P')
    expect(macrosLine(m(165), t)).toBe('165 kcal')
  })

  it('keeps a zero macro, which is data, not a missing value', () => {
    expect(macrosLine(m(90, 0, 22, null), t)).toBe('90 kcal · 0 P · 22 H')
  })

  it('rounds like the rest of the screen: kcal whole, grams one decimal', () => {
    expect(macrosLine(m(164.6, 30.55), t)).toBe('165 kcal · 30,6 P')
  })
})
