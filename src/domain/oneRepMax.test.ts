import { describe, expect, it } from 'vitest'
import { brzycki, epley, estimateSet1Rm } from './oneRepMax'
import type { SetEntry } from './types'

function set(partial: Partial<SetEntry>): SetEntry {
  return {
    order: 0,
    type: 'normal',
    weightKg: null,
    reps: null,
    durationSeconds: null,
    distanceMeters: null,
    rpe: null,
    completed: true,
    ...partial,
  }
}

describe('fórmulas de 1RM', () => {
  it('Epley: 100 kg × 5 ≈ 116,7', () => {
    expect(epley(100, 5)).toBeCloseTo(116.67, 1)
  })

  it('Brzycki: 100 kg × 5 = 112,5', () => {
    expect(brzycki(100, 5)).toBeCloseTo(112.5, 1)
  })

  it('con 1 rep ambas devuelven el propio peso', () => {
    expect(epley(120, 1)).toBe(120)
    expect(brzycki(120, 1)).toBe(120)
  })

  it('Brzycki no diverge con repeticiones altas', () => {
    expect(brzycki(50, 40)).toBeGreaterThan(0)
    expect(Number.isFinite(brzycki(50, 40))).toBe(true)
  })
})

describe('estimateSet1Rm', () => {
  it('estima para una serie efectiva con peso y reps', () => {
    expect(estimateSet1Rm(set({ weightKg: 100, reps: 5 }), 'epley')).toBeCloseTo(116.67, 1)
  })

  it('los calentamientos no cuentan', () => {
    expect(estimateSet1Rm(set({ weightKg: 100, reps: 5, type: 'warmup' }), 'epley')).toBeUndefined()
  })

  it('las series sin completar no cuentan', () => {
    expect(estimateSet1Rm(set({ weightKg: 100, reps: 5, completed: false }), 'epley')).toBeUndefined()
  })

  it('sin peso o sin reps no aplica', () => {
    expect(estimateSet1Rm(set({ reps: 10 }), 'epley')).toBeUndefined()
    expect(estimateSet1Rm(set({ weightKg: 80 }), 'epley')).toBeUndefined()
    expect(estimateSet1Rm(set({ weightKg: 80, reps: 0 }), 'epley')).toBeUndefined()
  })
})
