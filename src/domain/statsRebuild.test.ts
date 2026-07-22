import { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import { rebuildAllStats, rebuildStatsForExercise } from './statsRebuild'
import type { SetEntry, WithId, Workout, WorkoutExercise } from './types'

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

function exercise(exerciseId: string, sets: SetEntry[]): WorkoutExercise {
  return {
    exerciseId,
    exerciseName: exerciseId.toUpperCase(),
    muscle: 'chest',
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

function workout(id: string, dateKey: string, exercises: WorkoutExercise[]): WithId<Workout> {
  return {
    id,
    status: 'completed',
    name: 'Sesión',
    routineId: null,
    startedAt: Timestamp.fromDate(new Date(`${dateKey}T10:00:00`)),
    completedAt: null,
    durationSeconds: null,
    dateKey,
    notes: null,
    bodyWeightKg: null,
    exerciseIds: exercises.map((e) => e.exerciseId),
    exercises,
    totalVolumeKg: null,
    totalSets: null,
    prCount: null,
    setsByMuscle: null,
  }
}

describe('rebuildStatsForExercise', () => {
  it('sin la sesión del récord, el récord baja al siguiente mejor', () => {
    const withBest = [
      workout('w1', '2026-01-05', [exercise('press', [set({ weightKg: 80, reps: 5 })])]),
      workout('w2', '2026-01-12', [exercise('press', [set({ weightKg: 100, reps: 3 })])]),
      workout('w3', '2026-01-19', [exercise('press', [set({ weightKg: 85, reps: 5 })])]),
    ]
    const full = rebuildStatsForExercise(withBest, 'press')!
    expect(full.prs.heaviestWeightKg?.value).toBe(100)

    const withoutBest = rebuildStatsForExercise(
      withBest.filter((w) => w.id !== 'w2'),
      'press',
    )!
    expect(withoutBest.prs.heaviestWeightKg).toEqual({
      value: 85,
      workoutId: 'w3',
      dateKey: '2026-01-19',
    })
  })

  it('atribuye el récord a la primera sesión que lo alcanzó', () => {
    const sessions = [
      workout('w1', '2026-01-05', [exercise('press', [set({ weightKg: 90, reps: 5 })])]),
      workout('w2', '2026-01-12', [exercise('press', [set({ weightKg: 90, reps: 5 })])]),
    ]
    const stats = rebuildStatsForExercise(sessions, 'press')!
    expect(stats.prs.heaviestWeightKg?.workoutId).toBe('w1')
  })

  it('lastPerformance es la última sesión y totalSessions solo cuenta las suyas', () => {
    const sessions = [
      workout('w1', '2026-01-05', [exercise('press', [set({ weightKg: 80, reps: 5 })])]),
      workout('w2', '2026-01-12', [exercise('curl', [set({ weightKg: 20, reps: 10 })])]),
      workout('w3', '2026-01-19', [exercise('press', [set({ weightKg: 82.5, reps: 5 })])]),
    ]
    const stats = rebuildStatsForExercise(sessions, 'press')!
    expect(stats.totalSessions).toBe(2)
    expect(stats.lastPerformance?.workoutId).toBe('w3')
    expect(stats.lastPerformance?.sets[0]?.weightKg).toBe(82.5)
    expect(stats.exerciseName).toBe('PRESS')
  })

  it('devuelve null si el ejercicio no aparece en el historial', () => {
    const sessions = [workout('w1', '2026-01-05', [exercise('curl', [set({ reps: 10 })])])]
    expect(rebuildStatsForExercise(sessions, 'press')).toBeNull()
  })
})

describe('reconstrucción con peso corporal', () => {
  it('las sesiones sin peso registrado no aportan volumen; las que lo tienen, sí', () => {
    const bwExercise = (sets: SetEntry[]) => ({
      ...exercise('pullup', sets),
      measurement: 'reps_only' as const,
      usesBodyweight: true,
    })
    const sessions = [
      workout('w1', '2026-01-05', [bwExercise([set({ reps: 10 })])]),
      { ...workout('w2', '2026-01-12', [bwExercise([set({ reps: 8 })])]), bodyWeightKg: 80 },
    ]
    const stats = rebuildStatsForExercise(sessions, 'pullup')!
    expect(stats.prs.mostReps?.value).toBe(10)
    expect(stats.prs.bestSetVolumeKg).toEqual({
      value: 640,
      workoutId: 'w2',
      dateKey: '2026-01-12',
    })
  })
})

describe('rebuildAllStats', () => {
  it('reconstruye cada ejercicio presente y omite el resto', () => {
    const sessions = [
      workout('w1', '2026-01-05', [
        exercise('press', [set({ weightKg: 80, reps: 5 })]),
        exercise('curl', [set({ weightKg: 20, reps: 10 })]),
      ]),
      workout('w2', '2026-01-12', [exercise('press', [set({ weightKg: 85, reps: 5 })])]),
    ]
    const all = rebuildAllStats(sessions)
    expect([...all.keys()].sort()).toEqual(['curl', 'press'])
    expect(all.get('press')?.totalSessions).toBe(2)
    expect(all.get('curl')?.prs.heaviestWeightKg?.value).toBe(20)
  })
})
