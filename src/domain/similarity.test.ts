import { describe, expect, it } from 'vitest'
import { rankSimilar } from './similarity'
import { CATALOG } from '@/data/catalog/exercises'

const byId = new Map(CATALOG.map((e) => [e.id, e]))

describe('rankSimilar', () => {
  it('para press de banca sugiere primero otros press horizontales/inclinados', () => {
    const target = byId.get('bb-bench-press')!
    const similar = rankSimilar(target, CATALOG)
    const ids = similar.map((s) => s.id)

    expect(ids).not.toContain('bb-bench-press')
    // Same movement and same muscle dominate the ranking
    expect(ids.slice(0, 4)).toEqual(
      expect.arrayContaining(['db-bench-press', 'smith-bench-press', 'machine-chest-press']),
    )
    // No leg exercises among the ones similar to bench press
    expect(ids).not.toContain('bb-squat')
    expect(ids).not.toContain('leg-press')
  })

  it('para sentadilla sugiere prensa, hack y multipower', () => {
    const target = byId.get('bb-squat')!
    const ids = rankSimilar(target, CATALOG).map((s) => s.id)
    expect(ids).toEqual(expect.arrayContaining(['smith-squat', 'leg-press', 'hack-squat']))
  })

  it('exige compartir movimiento o músculo', () => {
    const target = byId.get('plank')!
    const ids = rankSimilar(target, CATALOG).map((s) => s.id)
    for (const id of ids) {
      const e = byId.get(id)!
      expect(e.movement === target.movement || e.muscle === target.muscle).toBe(true)
    }
  })

  it('excluye ejercicios retirados', () => {
    const target = { ...byId.get('bb-bench-press')!, id: 'x' }
    const withDeprecated = [...CATALOG, { ...byId.get('db-bench-press')!, id: 'dep', deprecated: true }]
    const ids = rankSimilar(target, withDeprecated).map((s) => s.id)
    expect(ids).not.toContain('dep')
  })
})
