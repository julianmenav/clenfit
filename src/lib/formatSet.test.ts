import { describe, expect, it } from 'vitest'
import { formatSet } from './formatSet'
import type { SetEntry } from '@/domain/types'

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

describe('formatSet · reps_only', () => {
  it('sin lastre muestra solo las reps', () => {
    expect(formatSet(set({ reps: 12 }), 'reps_only')).toBe('12 reps')
  })

  it('con lastre lo muestra como carga añadida', () => {
    expect(formatSet(set({ weightKg: 10, reps: 12 }), 'reps_only')).toBe('+10 kg × 12')
    expect(formatSet(set({ weightKg: 2.5, reps: 8 }), 'reps_only')).toBe('+2,5 kg × 8')
  })

  it('lastre sin reps sigue mostrando la carga', () => {
    expect(formatSet(set({ weightKg: 10 }), 'reps_only')).toBe('+10 kg × —')
  })
})
