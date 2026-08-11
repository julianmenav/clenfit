import { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import { prDetailSchema, reminderSchema, workoutExerciseSchema, workoutSchema } from './types'

const legacyExercise = {
  exerciseId: 'bb-bench-press',
  exerciseName: 'Press de banca',
  muscle: 'chest',
  measurement: 'weight_reps',
  order: 0,
  slotIndex: null,
  usesBodyweight: false,
  swappedFrom: null,
  restSeconds: null,
  sets: [],
}

describe('workoutExerciseSchema', () => {
  it('los docs antiguos sin `notes` parsean con null', () => {
    const parsed = workoutExerciseSchema.parse(legacyExercise)
    expect(parsed.notes).toBeNull()
  })

  it('`notes` sobrevive el round-trip', () => {
    const parsed = workoutExerciseSchema.parse({ ...legacyExercise, notes: 'mejor técnica hoy' })
    expect(parsed.notes).toBe('mejor técnica hoy')
  })
})

describe('workoutSchema.prDetails', () => {
  it('los docs antiguos sin prDetails parsean con null', () => {
    const legacy = {
      status: 'completed',
      name: 'Sesión',
      routineId: null,
      startedAt: Timestamp.fromDate(new Date('2026-01-05T10:00:00')),
      completedAt: null,
      durationSeconds: null,
      dateKey: '2026-01-05',
      notes: null,
      bodyWeightKg: null,
      exerciseIds: [],
      exercises: [],
      totalVolumeKg: null,
      totalSets: null,
      prCount: 2,
      setsByMuscle: null,
    }
    expect(workoutSchema.parse(legacy).prDetails).toBeNull()
  })

  it('acepta y conserva un prDetails con entradas', () => {
    const detail = {
      exerciseId: 'press',
      exerciseName: 'Press banca',
      type: 'heaviestWeightKg',
      value: 100,
      previousValue: 95,
    }
    expect(prDetailSchema.parse(detail)).toEqual(detail)
    expect(prDetailSchema.parse({ ...detail, previousValue: null }).previousValue).toBeNull()
  })
})

describe('reminderSchema', () => {
  const base = {
    enabled: true,
    routineIds: null,
    messages: ['FOCUS.'],
    createdAt: Timestamp.now(),
  }

  it('acepta los cuatro tipos de disparador', () => {
    expect(() => reminderSchema.parse({ ...base, trigger: { type: 'workoutStart' } })).not.toThrow()
    expect(() => reminderSchema.parse({ ...base, trigger: { type: 'workoutFinish' } })).not.toThrow()
    expect(() =>
      reminderSchema.parse({
        ...base,
        trigger: { type: 'beforeExercise', exerciseId: 'press', exerciseName: 'Press banca' },
      }),
    ).not.toThrow()
    expect(() =>
      reminderSchema.parse({ ...base, trigger: { type: 'beforeMuscle', muscle: 'quads' } }),
    ).not.toThrow()
  })

  it('rechaza mensajes vacíos', () => {
    expect(() =>
      reminderSchema.parse({ ...base, messages: [], trigger: { type: 'workoutStart' } }),
    ).toThrow()
    expect(() =>
      reminderSchema.parse({ ...base, messages: [''], trigger: { type: 'workoutStart' } }),
    ).toThrow()
  })
})
