import { describe, expect, it } from 'vitest'
import { countPrDetails, mergePrDetails, prDisplayGroups } from './prDetails'
import type { PrDetail } from './types'

const d = (partial: Partial<PrDetail>): PrDetail => ({
  exerciseId: 'press',
  exerciseName: 'Press banca',
  type: 'heaviestWeightKg',
  value: 100,
  previousValue: 95,
  ...partial,
})

describe('mergePrDetails', () => {
  it('reemplaza solo las entradas de los ejercicios recalculados', () => {
    const current = [d({}), d({ exerciseId: 'curl', exerciseName: 'Curl' })]
    const merged = mergePrDetails(current, new Set(['press']), [d({ value: 105 })])
    expect(merged).toEqual([d({ exerciseId: 'curl', exerciseName: 'Curl' }), d({ value: 105 })])
  })

  it('un ejercicio recalculado sin eventos pierde sus entradas', () => {
    expect(mergePrDetails([d({})], new Set(['press']), [])).toEqual([])
  })
})

describe('countPrDetails', () => {
  it('el par de fórmulas 1RM cuenta una sola vez por ejercicio', () => {
    const details = [
      d({ type: 'best1RmEpley' }),
      d({ type: 'best1RmBrzycki' }),
      d({ type: 'mostReps' }),
      d({ exerciseId: 'curl', type: 'best1RmEpley' }),
    ]
    expect(countPrDetails(details)).toBe(3)
  })
})

describe('prDisplayGroups', () => {
  it('agrupa por ejercicio y colapsa el 1RM a la fórmula elegida', () => {
    const details = [
      d({ type: 'best1RmEpley', value: 110, previousValue: 100 }),
      d({ type: 'best1RmBrzycki', value: 112, previousValue: 102 }),
      d({ exerciseId: 'curl', exerciseName: 'Curl', type: 'mostReps', value: 12, previousValue: null }),
    ]
    const groups = prDisplayGroups(details, 'brzycki')
    expect(groups).toHaveLength(2)
    expect(groups[0].rows).toEqual([{ display: 'best1Rm', value: 112, previousValue: 102 }])
    expect(groups[1]).toMatchObject({
      exerciseName: 'Curl',
      rows: [{ display: 'mostReps', value: 12, previousValue: null }],
    })
  })

  it('si solo mejoró la otra fórmula, se muestra esa', () => {
    const groups = prDisplayGroups([d({ type: 'best1RmBrzycki', value: 112 })], 'epley')
    expect(groups[0].rows[0]).toMatchObject({ display: 'best1Rm', value: 112 })
  })
})
