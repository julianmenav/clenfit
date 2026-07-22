import { describe, expect, it } from 'vitest'
import {
  balanceGroupOf,
  bucketedTotals,
  compareWeeks,
  muscleBalance,
  muscleSetBreakdown,
  repRangeDistribution,
  repRangeOf,
  runningMaxFlags,
} from './analytics'
import {
  muscleGroups,
  type MuscleGroup,
  type SetEntry,
  type Workout,
  type WorkoutExercise,
} from './types'

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
        usesBodyweight: false,
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

describe('muscleSetBreakdown', () => {
  const ex = (
    exerciseId: string,
    muscle: MuscleGroup,
    workingSets: number,
    warmups = 0,
  ): WorkoutExercise => ({
    exerciseId,
    exerciseName: exerciseId.toUpperCase(),
    muscle,
    measurement: 'weight_reps',
    usesBodyweight: false,
    order: 0,
    slotIndex: null,
    swappedFrom: null,
    restSeconds: null,
    notes: null,
    sets: [
      ...Array.from({ length: workingSets }, (_, i) => set({ order: i, reps: 8 })),
      ...Array.from({ length: warmups }, (_, i) =>
        set({ order: workingSets + i, reps: 8, type: 'warmup' as const }),
      ),
    ],
  })
  const secondaries: Record<string, MuscleGroup[]> = {
    press: ['triceps', 'shoulders'],
    curl: [],
  }
  const resolve = (id: string) => secondaries[id] ?? []

  it('primario cuenta 1.0 y cada secundario 0.5, excluyendo calentamientos', () => {
    const out = muscleSetBreakdown([{ exercises: [ex('press', 'chest', 4, 2)] }], resolve)
    expect(out.get('chest')).toMatchObject({ direct: 4, indirect: 0 })
    expect(out.get('triceps')).toMatchObject({ direct: 0, indirect: 2 })
    expect(out.get('shoulders')).toMatchObject({ direct: 0, indirect: 2 })
  })

  it('acumula entre entrenos y mezcla directas con indirectas', () => {
    const out = muscleSetBreakdown(
      [
        { exercises: [ex('press', 'chest', 3), ex('extension', 'triceps', 2)] },
        { exercises: [ex('press', 'chest', 3)] },
      ],
      resolve,
    )
    expect(out.get('triceps')).toMatchObject({ direct: 2, indirect: 3 })
  })

  it('topExercises ordena por series y desempata por nombre', () => {
    const out = muscleSetBreakdown(
      [{ exercises: [ex('b-row', 'back', 3), ex('a-row', 'back', 3), ex('pulldown', 'back', 5)] }],
      resolve,
    )
    expect(out.get('back')?.topExercises.map((e) => e.exerciseId)).toEqual([
      'pulldown',
      'a-row',
      'b-row',
    ])
  })

  it('los ejercicios sin series efectivas no aparecen', () => {
    const out = muscleSetBreakdown([{ exercises: [ex('press', 'chest', 0, 3)] }], resolve)
    expect(out.size).toBe(0)
  })
})

describe('bucketedTotals', () => {
  const weekOf = (dateKey: string) => (dateKey < '2026-07-13' ? '2026-07-06' : '2026-07-13')
  const w = (dateKey: string, v: number) => ({ dateKey, v })

  it('por día agrupa por dateKey y ordena ascendente', () => {
    const out = bucketedTotals(
      [w('2026-07-15', 100), w('2026-07-14', 50), w('2026-07-15', 25)],
      (x) => x.v,
      'day',
      weekOf,
    )
    expect(out).toEqual([
      { bucket: '2026-07-14', value: 50 },
      { bucket: '2026-07-15', value: 125 },
    ])
  })

  it('por semana usa la clave de inicio de semana inyectada', () => {
    const out = bucketedTotals(
      [w('2026-07-08', 10), w('2026-07-15', 20), w('2026-07-16', 5)],
      (x) => x.v,
      'week',
      weekOf,
    )
    expect(out).toEqual([
      { bucket: '2026-07-06', value: 10 },
      { bucket: '2026-07-13', value: 25 },
    ])
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
