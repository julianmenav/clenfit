import { describe, expect, it } from 'vitest'
import {
  normalizeEditedSets,
  withAddedExercise,
  withAddedSet,
  withCycledSetType,
  withMovedExercise,
  withRemovedExercise,
  withRemovedSet,
  withSetPatch,
} from './workoutEdit'
import type { SetEntry, WorkoutExercise } from './types'

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

function exercise(sets: SetEntry[], name = 'X'): WorkoutExercise {
  return {
    exerciseId: name.toLowerCase(),
    exerciseName: name,
    muscle: 'chest',
    measurement: 'weight_reps',
    usesBodyweight: false,
    order: 0,
    slotIndex: null,
    swappedFrom: null,
    restSeconds: null,
    notes: null,
    sets,
  }
}

describe('normalizeEditedSets', () => {
  it('las series con datos quedan completadas y las vacías se descartan', () => {
    const out = normalizeEditedSets([
      exercise([set({ weightKg: 60, reps: 8 }), set({ order: 1 }), set({ order: 2, reps: 12 })]),
    ])
    expect(out[0].sets).toHaveLength(2)
    expect(out[0].sets.every((s) => s.completed)).toBe(true)
    expect(out[0].sets.map((s) => s.order)).toEqual([0, 1])
  })

  it('conserva el tipo de serie (los calentamientos siguen siendo calentamientos)', () => {
    const out = normalizeEditedSets([exercise([set({ weightKg: 40, reps: 10, type: 'warmup' })])])
    expect(out[0].sets[0].type).toBe('warmup')
  })

  it('elimina ejercicios sin ninguna serie con datos y reindexa el resto', () => {
    const out = normalizeEditedSets([exercise([set({})], 'A'), exercise([set({ reps: 5 })], 'B')])
    expect(out).toHaveLength(1)
    expect(out[0].exerciseName).toBe('B')
    expect(out[0].order).toBe(0)
  })
})

describe('mutaciones del borrador', () => {
  const w = {
    exercises: [
      exercise([set({ weightKg: 60, reps: 8 })], 'A'),
      { ...exercise([set({})], 'B'), order: 1 },
    ],
  }

  it('withSetPatch cambia solo la serie indicada', () => {
    const out = withSetPatch(w, 0, 0, { weightKg: 62.5 })
    expect(out.exercises[0].sets[0].weightKg).toBe(62.5)
    expect(w.exercises[0].sets[0].weightKg).toBe(60)
  })

  it('withAddedSet clona la última serie sin completar y como normal', () => {
    const base = { exercises: [exercise([set({ weightKg: 60, reps: 8, type: 'dropset', completed: true })])] }
    const out = withAddedSet(base, 0)
    const added = out.exercises[0].sets[1]
    expect(added).toMatchObject({ weightKg: 60, reps: 8, type: 'normal', completed: false, order: 1 })
  })

  it('withRemovedSet reindexa los órdenes', () => {
    const base = { exercises: [exercise([set({ reps: 1 }), set({ order: 1, reps: 2 }), set({ order: 2, reps: 3 })])] }
    const out = withRemovedSet(base, 0, 1)
    expect(out.exercises[0].sets.map((s) => [s.order, s.reps])).toEqual([
      [0, 1],
      [1, 3],
    ])
  })

  it('withCycledSetType recorre normal → warmup → dropset → failure → normal', () => {
    let out = withCycledSetType(w, 0, 0)
    expect(out.exercises[0].sets[0].type).toBe('warmup')
    out = withCycledSetType(out, 0, 0)
    expect(out.exercises[0].sets[0].type).toBe('dropset')
    out = withCycledSetType(out, 0, 0)
    expect(out.exercises[0].sets[0].type).toBe('failure')
    out = withCycledSetType(out, 0, 0)
    expect(out.exercises[0].sets[0].type).toBe('normal')
  })

  it('withAddedExercise / withRemovedExercise mantienen los órdenes', () => {
    const added = withAddedExercise(w, exercise([set({})], 'C'))
    expect(added.exercises.map((e) => [e.exerciseName, e.order])).toEqual([
      ['A', 0],
      ['B', 1],
      ['C', 2],
    ])
    const removed = withRemovedExercise(added, 0)
    expect(removed.exercises.map((e) => [e.exerciseName, e.order])).toEqual([
      ['B', 0],
      ['C', 1],
    ])
  })

  it('withMovedExercise ignora destinos fuera de rango', () => {
    expect(withMovedExercise(w, 0, 5)).toBe(w)
    const out = withMovedExercise(w, 0, 1)
    expect(out.exercises.map((e) => e.exerciseName)).toEqual(['B', 'A'])
  })
})
