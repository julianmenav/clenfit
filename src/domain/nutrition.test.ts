import { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import {
  dayTotals,
  entryMacros,
  foodFromEntry,
  goalForDay,
  hasGoal,
  proteinIndex,
  rankFoods,
  remaining,
  sumMacros,
  weekSummary,
} from './nutrition'
import type { Food, FoodEntry, Macros, NutritionDay, WithId } from './types'

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

const keys = [
  '2026-09-07',
  '2026-09-08',
  '2026-09-09',
  '2026-09-10',
  '2026-09-11',
  '2026-09-12',
  '2026-09-13',
]

const day = (dateKey: string, entries: FoodEntry[], goalKcal = 2000): NutritionDay => ({
  dateKey,
  goal: m(goalKcal, 150),
  entries,
  updatedAt: Timestamp.now(),
})

const eaten = (kcal: number, protein: number | null = null) => entry('perUnit', 1, m(kcal, protein))

describe('weekSummary', () => {
  it('media y balance solo sobre los días con registros', () => {
    const s = weekSummary(
      keys,
      [day('2026-09-07', [eaten(1700, 100)]), day('2026-09-08', [eaten(2300, 120)])],
      goal,
    )
    expect(s.loggedDays).toBe(2)
    expect(s.avg).toEqual(m(2000, 110, null, null))
    expect(s.balanceKcal).toBe(0)
    expect(s.days).toHaveLength(7)
    expect(s.days[0]).toEqual({
      dateKey: '2026-09-07',
      logged: true,
      kcal: 1700,
      protein: 100,
      goalKcal: 2000,
    })
    expect(s.days[2]).toEqual({
      dateKey: '2026-09-09',
      logged: false,
      kcal: 0,
      protein: null,
      goalKcal: 2000,
    })
  })

  it('cada día se compara con su objetivo guardado; los no registrados con el actual', () => {
    const s = weekSummary(keys, [day('2026-09-07', [eaten(1800)], 1800)], m(2500))
    expect(s.balanceKcal).toBe(0)
    expect(s.days[0].goalKcal).toBe(1800)
    expect(s.days[1].goalKcal).toBe(2500)
  })

  it('el balance es negativo por debajo y positivo por encima', () => {
    const s = weekSummary(
      keys,
      [day('2026-09-07', [eaten(1700)]), day('2026-09-08', [eaten(2100)])],
      goal,
    )
    expect(s.balanceKcal).toBe(-200)
  })

  it('semana vacía → avg null, balance 0, siete celdas', () => {
    const s = weekSummary(keys, [], goal)
    expect(s.avg).toBeNull()
    expect(s.balanceKcal).toBe(0)
    expect(s.loggedDays).toBe(0)
    expect(s.days.every((d) => !d.logged)).toBe(true)
  })

  it('un doc sin entradas no cuenta como día registrado', () => {
    const s = weekSummary(keys, [day('2026-09-07', [])], goal)
    expect(s.loggedDays).toBe(0)
    expect(s.days[0].logged).toBe(false)
  })
})

describe('goalForDay', () => {
  const today = '2026-09-10'
  const snap = { goal: m(1800, 120) }

  it('hoy y el futuro siguen el objetivo actual', () => {
    expect(goalForDay(snap, today, today, goal)).toEqual(goal)
    expect(goalForDay(null, '2026-09-11', today, goal)).toEqual(goal)
  })

  it('un día pasado conserva su objetivo guardado', () => {
    expect(goalForDay(snap, '2026-09-01', today, goal)).toEqual(snap.goal)
  })

  it('un día pasado sin registro usa el actual', () => {
    expect(goalForDay(null, '2026-09-01', today, goal)).toEqual(goal)
  })
})

const food = (name: string, over: Partial<Food> = {}): WithId<Food> => ({
  id: name,
  name,
  kind: 'per100g',
  unitLabel: null,
  per: m(100, 10),
  lastAmount: null,
  useCount: 0,
  lastUsedAt: null,
  createdAt: Timestamp.now(),
  ...over,
})

describe('rankFoods', () => {
  it('sin consulta: último uso, luego veces usado, luego nombre', () => {
    const list = [
      food('Pan'),
      food('Atún', { useCount: 5 }),
      food('Huevo', { lastUsedAt: Timestamp.fromMillis(1000) }),
      food('Arroz', { useCount: 5 }),
    ]
    expect(rankFoods(list, '  ').map((f) => f.name)).toEqual(['Huevo', 'Arroz', 'Atún', 'Pan'])
  })

  it('con consulta busca sin acentos ni mayúsculas', () => {
    const list = [food('Atún en lata'), food('Pan'), food('Pechuga de pollo')]
    expect(rankFoods(list, 'atun').map((f) => f.name)).toEqual(['Atún en lata'])
    expect(rankFoods(list, 'POLLO').map((f) => f.name)).toEqual(['Pechuga de pollo'])
  })
})

describe('foodFromEntry', () => {
  it('crea el alimento con la cantidad como prefill y un uso', () => {
    const e = entry('perUnit', 2, m(70, 6), { name: ' Huevo ', unitLabel: 'huevo' })
    expect(foodFromEntry(e)).toEqual({
      name: 'Huevo',
      kind: 'perUnit',
      unitLabel: 'huevo',
      per: m(70, 6),
      lastAmount: 2,
      useCount: 1,
    })
  })

  it('por 100 g nunca lleva etiqueta de unidad', () => {
    const e = entry('per100g', 150, m(100, 20), { unitLabel: 'lata' })
    expect(foodFromEntry(e).unitLabel).toBeNull()
  })
})
