import { describe, expect, it } from 'vitest'
import { ghostForSet } from './ghosts'
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
    completed: false,
    ...partial,
  }
}

describe('ghostForSet', () => {
  it('la serie alineada de la última sesión gana si existe', () => {
    const last = [set({ weightKg: 80, reps: 8 }), set({ weightKg: 85, reps: 6 })]
    const current = [set({ weightKg: 100 }), set({})]
    expect(ghostForSet(current, 1, last)).toBe(last[1])
  })

  it('sin historial ni pesos escritos no hay ghost', () => {
    const current = [set({}), set({}), set({})]
    expect(ghostForSet(current, 0, null)).toBeUndefined()
    expect(ghostForSet(current, 2, undefined)).toBeUndefined()
  })

  it('el peso de la primera serie se propaga como ghost al resto', () => {
    const current = [set({ weightKg: 60 }), set({}), set({})]
    for (const i of [1, 2]) {
      const ghost = ghostForSet(current, i, null)
      expect(ghost?.weightKg).toBe(60)
      expect(ghost?.reps).toBeNull()
      expect(ghost?.durationSeconds).toBeNull()
      expect(ghost?.distanceMeters).toBeNull()
      expect(ghost?.rpe).toBeNull()
      expect(ghost?.completed).toBe(false)
    }
  })

  it('gana la serie anterior más cercana con peso', () => {
    const current = [set({ weightKg: 100 }), set({ weightKg: 105 }), set({})]
    expect(ghostForSet(current, 2, null)?.weightKg).toBe(105)
  })

  it('salta series anteriores sin peso', () => {
    const current = [set({}), set({ weightKg: 80 }), set({})]
    expect(ghostForSet(current, 2, null)?.weightKg).toBe(80)
    expect(ghostForSet(current, 1, null)).toBeUndefined()
  })

  it('una fila más allá del historial usa el fallback de la sesión actual', () => {
    const last = [set({ weightKg: 80, reps: 8 })]
    const current = [set({ weightKg: 90 }), set({})]
    expect(ghostForSet(current, 1, last)?.weightKg).toBe(90)
  })
})
