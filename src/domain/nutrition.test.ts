import { describe, expect, it } from 'vitest'
import { dayTotals, entryMacros, hasGoal, proteinIndex, remaining, sumMacros } from './nutrition'
import type { FoodEntry, Macros } from './types'

const m = (
  kcal: number,
  protein: number | null = null,
  carbs: number | null = null,
  fat: number | null = null,
): Macros => ({ kcal, protein, carbs, fat })

const goal = m(2000, 150)

const entry = (
  kind: FoodEntry['kind'],
  amount: number,
  per: Macros,
  over: Partial<FoodEntry> = {},
): FoodEntry => ({
  id: 'e',
  foodId: null,
  name: 'Algo',
  kind,
  unitLabel: null,
  amount,
  per,
  ...over,
})

describe('entryMacros', () => {
  it('por 100 g escala por gramos/100', () => {
    expect(entryMacros(entry('per100g', 150, m(100, 20, 10, 2)))).toEqual(m(150, 30, 15, 3))
  })

  it('por unidad multiplica por las unidades (decimales permitidos)', () => {
    expect(entryMacros(entry('perUnit', 2.5, m(70, 6)))).toEqual(m(175, 15, null, null))
  })

  it('los componentes nulos se quedan nulos', () => {
    expect(entryMacros(entry('per100g', 50, m(200)))).toEqual(m(100))
  })
})

describe('sumMacros / dayTotals', () => {
  it('suma kcal siempre y un opcional solo si alguna entrada lo tiene', () => {
    expect(sumMacros([m(100, 10), m(200), m(50, 5, 3)])).toEqual(m(350, 15, 3, null))
  })

  it('lista vacía → 0 kcal y opcionales nulos', () => {
    expect(sumMacros([])).toEqual(m(0))
  })

  it('dayTotals suma las entradas ya escaladas', () => {
    const entries = [entry('per100g', 200, m(100, 10)), entry('perUnit', 2, m(70, 6))]
    expect(dayTotals(entries)).toEqual(m(340, 32, null, null))
  })
})

describe('proteinIndex', () => {
  it('vale 1 cuando la densidad proteica iguala la del objetivo', () => {
    expect(proteinIndex(m(200, 15), goal)).toBeCloseTo(1)
  })

  it('vale 2 cuando dobla la densidad del objetivo', () => {
    expect(proteinIndex(m(200, 30), goal)).toBeCloseTo(2)
  })

  it('null sin proteína en la comida, sin objetivo de proteína o con 0 kcal', () => {
    expect(proteinIndex(m(200), goal)).toBeNull()
    expect(proteinIndex(m(200, 15), m(2000))).toBeNull()
    expect(proteinIndex(m(0, 15), goal)).toBeNull()
  })
})

describe('remaining', () => {
  it('resta lo comido y deja null donde no hay objetivo', () => {
    expect(remaining(goal, m(1500, 100, 50, 20))).toEqual(m(500, 50, null, null))
  })

  it('sin proteína comida cuenta como 0 frente a un objetivo con proteína', () => {
    expect(remaining(goal, m(300))).toEqual(m(1700, 150, null, null))
  })

  it('puede ser negativo (te has pasado)', () => {
    expect(remaining(goal, m(2300)).kcal).toBe(-300)
  })
})

describe('hasGoal', () => {
  it('solo un objetivo con kcal > 0 cuenta como definido', () => {
    expect(hasGoal(null)).toBe(false)
    expect(hasGoal(undefined)).toBe(false)
    expect(hasGoal(m(0, 100))).toBe(false)
    expect(hasGoal(m(1850))).toBe(true)
  })
})
