import { describe, expect, it } from 'vitest'
import { CATALOG } from './exercises'
import { normalize } from '@/domain/search'
import { equipmentTypes, measurementTypes, movements, muscleGroups } from '@/domain/types'

describe('catálogo de ejercicios', () => {
  it('tiene un tamaño razonable', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(100)
  })

  it('ids únicos y con formato slug', () => {
    const ids = CATALOG.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('nombres normalizados únicos', () => {
    const names = CATALOG.map((e) => normalize(e.name))
    const dupes = names.filter((n, i) => names.indexOf(n) !== i)
    expect(dupes).toEqual([])
  })

  it('enums válidos en todas las entradas', () => {
    for (const e of CATALOG) {
      expect(muscleGroups).toContain(e.muscle)
      expect(equipmentTypes).toContain(e.equipment)
      expect(movements).toContain(e.movement)
      expect(measurementTypes).toContain(e.measurement)
      for (const m of e.secondaryMuscles ?? []) {
        expect(muscleGroups).toContain(m)
        expect(m).not.toBe(e.muscle)
      }
    }
  })

  it('los alias no duplican el propio nombre', () => {
    for (const e of CATALOG) {
      const name = normalize(e.name)
      for (const alias of e.aliases ?? []) {
        expect(normalize(alias)).not.toBe(name)
      }
    }
  })

  it('cubre todos los grupos musculares', () => {
    const covered = new Set(CATALOG.map((e) => e.muscle))
    for (const m of muscleGroups) expect(covered).toContain(m)
  })
})
