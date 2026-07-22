import { describe, expect, it } from 'vitest'
import { bestSet, pruneIncomplete, summarizeWorkout } from './workoutSummary'
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
    completed: true,
    ...partial,
  }
}

function exercise(sets: SetEntry[], muscle = 'chest'): WorkoutExercise {
  return {
    exerciseId: 'x',
    exerciseName: 'X',
    muscle: muscle as WorkoutExercise['muscle'],
    measurement: 'weight_reps',
    order: 0,
    slotIndex: null,
    usesBodyweight: false,
    swappedFrom: null,
    restSeconds: null,
    notes: null,
    sets,
  }
}

describe('summarizeWorkout', () => {
  it('calcula volumen, series y series por músculo', () => {
    const totals = summarizeWorkout({
      exercises: [
        exercise([set({ weightKg: 60, reps: 8 }), set({ weightKg: 60, reps: 8 })], 'chest'),
        exercise([set({ reps: 10 })], 'back'),
      ],
    })
    expect(totals.totalVolumeKg).toBe(960)
    expect(totals.totalSets).toBe(3)
    expect(totals.setsByMuscle).toEqual({ chest: 2, back: 1 })
  })
})

describe('bestSet', () => {
  it('elige la serie de mayor volumen', () => {
    const best = bestSet(
      exercise([set({ weightKg: 60, reps: 8 }), set({ weightKg: 80, reps: 8 })]),
    )
    expect(best?.weightKg).toBe(80)
  })

  it('sin peso, elige por reps', () => {
    const best = bestSet(exercise([set({ reps: 8 }), set({ reps: 12 })]))
    expect(best?.reps).toBe(12)
  })

  it('ignora calentamientos', () => {
    const best = bestSet(
      exercise([set({ weightKg: 100, reps: 5, type: 'warmup' }), set({ weightKg: 60, reps: 8 })]),
    )
    expect(best?.weightKg).toBe(60)
  })
})

describe('pruneIncomplete', () => {
  it('quita series sin completar y ejercicios vacíos, reordenando', () => {
    const pruned = pruneIncomplete([
      exercise([set({ weightKg: 60, reps: 8 }), set({ weightKg: 60, reps: 8, completed: false })]),
      exercise([set({ completed: false })]),
      exercise([set({ reps: 10 })]),
    ])
    expect(pruned).toHaveLength(2)
    expect(pruned[0].sets).toHaveLength(1)
    expect(pruned.map((e) => e.order)).toEqual([0, 1])
  })

  it('conserva las notas del ejercicio', () => {
    const withNotes = { ...exercise([set({ reps: 10 })]), notes: 'mejor técnica' }
    expect(pruneIncomplete([withNotes])[0].notes).toBe('mejor técnica')
  })
})
