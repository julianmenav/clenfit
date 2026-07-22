import { describe, expect, it } from 'vitest'
import { defUsesBodyweight, exerciseVolume, countWorkingSets, setsByMuscle, setVolume, workoutVolume } from './volume'
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

  it('el peso corporal sustituye la carga solo cuando la serie no tiene peso', () => {
    expect(setVolume(set({ reps: 10 }), 80)).toBe(800)
    expect(setVolume(set({ weightKg: 20, reps: 10 }), 80)).toBe(200)
    expect(setVolume(set({ reps: 10, type: 'warmup' }), 80)).toBe(0)
    expect(setVolume(set({ reps: 10, completed: false }), 80)).toBe(0)
  })

  it('exerciseVolume aplica el peso corporal solo si el ejercicio lo usa', () => {
    const bw = { ...exercise([set({ reps: 10 })]), usesBodyweight: true }
    expect(exerciseVolume(bw, 80)).toBe(800)
    expect(exerciseVolume(exercise([set({ reps: 10 })]), 80)).toBe(0)
    expect(exerciseVolume(bw, null)).toBe(0)
  })

  it('workoutVolume usa el peso corporal del entrenamiento', () => {
    const w = {
      exercises: [{ ...exercise([set({ reps: 10 })]), usesBodyweight: true }],
      bodyWeightKg: 80,
    }
    expect(workoutVolume(w)).toBe(800)
  })

  it('defUsesBodyweight: solo bodyweight + reps_only', () => {
    expect(defUsesBodyweight({ equipment: 'bodyweight', measurement: 'reps_only' })).toBe(true)
    expect(defUsesBodyweight({ equipment: 'bodyweight', measurement: 'time_only' })).toBe(false)
    expect(defUsesBodyweight({ equipment: 'barbell', measurement: 'reps_only' })).toBe(false)
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
