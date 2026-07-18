import { describe, expect, it } from 'vitest'
import {
  applySessionPrs,
  detectLiveSetPrs,
  displayPrCount,
  prDisplayType,
  sessionCandidates,
  setCandidates,
} from './prs'
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

function exercise(sets: SetEntry[]): WorkoutExercise {
  return {
    exerciseId: 'bb-bench-press',
    exerciseName: 'Press de banca',
    muscle: 'chest',
    measurement: 'weight_reps',
    order: 0,
    slotIndex: null,
    swappedFrom: null,
    restSeconds: null,
    notes: null,
    sets,
  }
}

describe('candidatos a récord', () => {
  it('una serie con peso genera candidatos de peso, 1RM, volumen y reps', () => {
    const c = setCandidates(set({ weightKg: 100, reps: 5 }))
    expect(c.heaviestWeightKg).toBe(100)
    expect(c.mostReps).toBe(5)
    expect(c.bestSetVolumeKg).toBe(500)
    expect(c.best1RmEpley).toBeCloseTo(116.67, 1)
    expect(c.best1RmBrzycki).toBeCloseTo(112.5, 1)
  })

  it('los calentamientos no generan candidatos', () => {
    expect(setCandidates(set({ weightKg: 200, reps: 5, type: 'warmup' }))).toEqual({})
  })

  it('la sesión añade el volumen total del ejercicio', () => {
    const c = sessionCandidates([set({ weightKg: 100, reps: 5 }), set({ weightKg: 90, reps: 8 })])
    expect(c.bestSessionVolumeKg).toBe(500 + 720)
    expect(c.bestSetVolumeKg).toBe(720)
    expect(c.heaviestWeightKg).toBe(100)
  })
})

describe('detección en vivo', () => {
  it('la primera sesión de un ejercicio no anuncia récords (establece la base)', () => {
    expect(detectLiveSetPrs(set({ weightKg: 100, reps: 5 }), [], null)).toEqual([])
    expect(
      detectLiveSetPrs(set({ weightKg: 100, reps: 5 }), [], { prs: {}, totalSessions: 0 }),
    ).toEqual([])
  })

  it('a partir de la segunda sesión, superar la base es récord', () => {
    const stats = {
      prs: { heaviestWeightKg: { value: 100, workoutId: 'w', dateKey: '2026-01-01' } },
      totalSessions: 1,
    }
    const prs = detectLiveSetPrs(set({ weightKg: 105, reps: 5 }), [], stats)
    expect(prs).toContain('heaviestWeightKg')
    expect(prs).not.toContain('bestSessionVolumeKg')
  })

  it('igualar no es récord: hay que superar', () => {
    const stats = {
      prs: { heaviestWeightKg: { value: 100, workoutId: 'w', dateKey: '2026-01-01' } },
      totalSessions: 1,
    }
    const prs = detectLiveSetPrs(set({ weightKg: 100, reps: 1 }), [], stats)
    expect(prs).not.toContain('heaviestWeightKg')
  })

  it('cuenta las series previas de la misma sesión', () => {
    const stats = {
      prs: { heaviestWeightKg: { value: 90, workoutId: 'w', dateKey: '2026-01-01' } },
      totalSessions: 1,
    }
    const prior = [set({ weightKg: 105, reps: 1 })]
    const prs = detectLiveSetPrs(set({ weightKg: 102, reps: 1 }), prior, stats)
    expect(prs).not.toContain('heaviestWeightKg')
  })
})

describe('applySessionPrs', () => {
  it('actualiza solo los tipos superados y conserva el resto', () => {
    const stats = {
      prs: {
        heaviestWeightKg: { value: 120, workoutId: 'old', dateKey: '2026-01-01' },
        mostReps: { value: 12, workoutId: 'old', dateKey: '2026-01-01' },
      },
      totalSessions: 3,
    }
    const { newPrs, prs } = applySessionPrs(
      exercise([set({ weightKg: 100, reps: 15 })]),
      stats,
      'w2',
      '2026-07-11',
    )
    expect(newPrs).toContain('mostReps')
    expect(newPrs).not.toContain('heaviestWeightKg')
    expect(prs.mostReps).toEqual({ value: 15, workoutId: 'w2', dateKey: '2026-07-11' })
    expect(prs.heaviestWeightKg).toEqual({ value: 120, workoutId: 'old', dateKey: '2026-01-01' })
  })

  it('sin historial, la primera sesión establece la base sin anunciar récords', () => {
    const { newPrs, prs } = applySessionPrs(
      exercise([set({ weightKg: 60, reps: 10 })]),
      null,
      'w1',
      '2026-07-11',
    )
    expect(newPrs).toEqual([])
    expect(prs.heaviestWeightKg).toEqual({ value: 60, workoutId: 'w1', dateKey: '2026-07-11' })
    expect(prs.mostReps).toEqual({ value: 10, workoutId: 'w1', dateKey: '2026-07-11' })
    expect(prs.bestSetVolumeKg).toEqual({ value: 600, workoutId: 'w1', dateKey: '2026-07-11' })
    expect(prs.bestSessionVolumeKg).toEqual({ value: 600, workoutId: 'w1', dateKey: '2026-07-11' })
    expect(prs.best1RmEpley?.value).toBeCloseTo(80, 1)
    expect(prs.best1RmBrzycki?.value).toBeCloseTo(80, 1)
  })

  it('la segunda sesión que supera la base sí anuncia récords', () => {
    const first = applySessionPrs(exercise([set({ weightKg: 60, reps: 10 })]), null, 'w1', '2026-07-11')
    const stats = { prs: first.prs, totalSessions: 1 }
    const { newPrs } = applySessionPrs(
      exercise([set({ weightKg: 65, reps: 10 })]),
      stats,
      'w2',
      '2026-07-14',
    )
    expect(newPrs).toContain('heaviestWeightKg')
    expect(newPrs).toContain('best1RmEpley')
    expect(newPrs).toContain('best1RmBrzycki')
  })
})

describe('récords de cara al usuario', () => {
  it('las dos fórmulas de 1RM colapsan en un solo tipo visible', () => {
    expect(prDisplayType('best1RmEpley')).toBe('best1Rm')
    expect(prDisplayType('best1RmBrzycki')).toBe('best1Rm')
  })

  it('displayPrCount cuenta el par de 1RM una sola vez', () => {
    expect(displayPrCount(['best1RmEpley', 'best1RmBrzycki', 'heaviestWeightKg'])).toBe(2)
    expect(displayPrCount([])).toBe(0)
  })
})
