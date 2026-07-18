import { describe, expect, it } from 'vitest'
import { countWorkingSets, setsByMuscle, setVolume, workoutVolume } from './volume'
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
    swappedFrom: null,
    restSeconds: null,
    notes: null,
    sets,
  }
}

describe('volumen', () => {
  it('serie = peso × reps', () => {
    expect(setVolume(set({ weightKg: 60, reps: 8 }))).toBe(480)
  })

  it('los calentamientos y las series sin completar no suman', () => {
    expect(setVolume(set({ weightKg: 60, reps: 8, type: 'warmup' }))).toBe(0)
    expect(setVolume(set({ weightKg: 60, reps: 8, completed: false }))).toBe(0)
  })

  it('dropset y fallo sí suman', () => {
    expect(setVolume(set({ weightKg: 40, reps: 12, type: 'dropset' }))).toBe(480)
    expect(setVolume(set({ weightKg: 80, reps: 5, type: 'failure' }))).toBe(400)
  })

  it('volumen de entrenamiento suma todos los ejercicios', () => {
    const w = {
      exercises: [
        exercise([set({ weightKg: 60, reps: 8 }), set({ weightKg: 60, reps: 8, type: 'warmup' })]),
        exercise([set({ weightKg: 100, reps: 5 })]),
      ],
    }
    expect(workoutVolume(w)).toBe(60 * 8 + 100 * 5)
    expect(countWorkingSets(w)).toBe(2)
  })

  it('series por grupo muscular excluye calentamientos', () => {
    const w = {
      exercises: [
        exercise(
          [set({ weightKg: 60, reps: 8 }), set({ weightKg: 40, reps: 8, type: 'warmup' })],
          'chest',
        ),
        exercise([set({ reps: 10 }), set({ reps: 8 })], 'back'),
      ],
    }
    expect(setsByMuscle(w)).toEqual({ chest: 1, back: 2 })
  })
})
