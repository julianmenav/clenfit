import { describe, expect, it } from 'vitest'
import {
  balanceGroupOf,
  compareWeeks,
  muscleBalance,
  repRangeDistribution,
  repRangeOf,
  runningMaxFlags,
} from './analytics'
import { muscleGroups, type SetEntry, type Workout } from './types'

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

function workoutWithSets(sets: SetEntry[]): Pick<Workout, 'exercises'> {
  return {
    exercises: [
      {
        exerciseId: 'x',
        exerciseName: 'X',
        muscle: 'chest',
        measurement: 'weight_reps',
        order: 0,
        slotIndex: null,
        swappedFrom: null,
        restSeconds: null,
        notes: null,
        sets,
      },
    ],
  }
}

describe('rangos de repeticiones', () => {
  it('clasifica por los límites 5 y 12', () => {
    expect(repRangeOf(1)).toBe('strength')
    expect(repRangeOf(5)).toBe('strength')
    expect(repRangeOf(6)).toBe('hypertrophy')
    expect(repRangeOf(12)).toBe('hypertrophy')
    expect(repRangeOf(13)).toBe('endurance')
  })

  it('excluye calentamientos, series sin completar y sin reps', () => {
    const dist = repRangeDistribution([
      workoutWithSets([
        set({ reps: 5 }),
        set({ reps: 10 }),
        set({ reps: 15 }),
        set({ reps: 10, type: 'warmup' }),
        set({ reps: 10, completed: false }),
        set({ weightKg: 100 }),
      ]),
    ])
    expect(dist).toEqual({ strength: 1, hypertrophy: 1, endurance: 1 })
  })
})

describe('equilibrio muscular', () => {
  it('todos los grupos musculares tienen grupo de equilibrio salvo cardio', () => {
    for (const m of muscleGroups) {
      if (m === 'cardio') expect(balanceGroupOf(m)).toBeNull()
      else expect(balanceGroupOf(m)).not.toBeNull()
    }
  })

  it('agrega setsByMuscle entre entrenos y excluye cardio', () => {
    const balance = muscleBalance([
      { setsByMuscle: { chest: 3, triceps: 2, back: 4, cardio: 5 } },
      { setsByMuscle: { quads: 6, core: 1, biceps: 2 } },
      { setsByMuscle: {} },
    ])
    expect(balance).toEqual({ push: 5, pull: 6, legs: 6, core: 1 })
  })
})

describe('runningMaxFlags', () => {
  it('marca solo los máximos estrictos y nunca el primero', () => {
    expect(runningMaxFlags([100, 100, 105, 102, 110])).toEqual([
      false,
      false,
      true,
      false,
      true,
    ])
  })

  it('lista vacía', () => {
    expect(runningMaxFlags([])).toEqual([])
  })
})

describe('compareWeeks', () => {
  const w = (dateKey: string, totalSets: number, totalVolumeKg: number) => ({
    dateKey,
    totalSets,
    totalVolumeKg,
  })

  it('separa semana actual y anterior por dateKey, ignorando lo previo', () => {
    const { current, previous } = compareWeeks(
      [
        w('2026-07-13', 12, 3000), // current week (starts Monday 13th)
        w('2026-07-08', 10, 2500), // previous week
        w('2026-07-06', 8, 2000), // previous week boundary (Monday 6th)
        w('2026-07-05', 9, 1000), // before the window
      ],
      '2026-07-13',
      '2026-07-06',
    )
    expect(current).toEqual({ workouts: 1, sets: 12, volumeKg: 3000 })
    expect(previous).toEqual({ workouts: 2, sets: 18, volumeKg: 4500 })
  })

  it('tolera totales nulos', () => {
    const { current } = compareWeeks(
      [{ dateKey: '2026-07-13', totalSets: null, totalVolumeKg: null }],
      '2026-07-13',
      '2026-07-06',
    )
    expect(current).toEqual({ workouts: 1, sets: 0, volumeKg: 0 })
  })
})
