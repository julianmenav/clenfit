import { Timestamp } from 'firebase/firestore'
import { describe, expect, it } from 'vitest'
import {
  foodEntrySchema,
  macrosSchema,
  nutritionDaySchema,
  prDetailSchema,
  reminderSchema,
  userSettingsSchema,
  workoutExerciseSchema,
  workoutSchema,
} from './types'

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
    expect(() =>
      reminderSchema.parse({ ...base, trigger: { type: 'workoutFinish' } }),
    ).not.toThrow()
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

describe('nutrición: esquemas', () => {
  const entry = {
    id: 'e1',
    foodId: null,
    name: 'Huevo',
    kind: 'perUnit',
    unitLabel: 'huevo',
    amount: 2,
    per: { kcal: 70, protein: 6, carbs: null, fat: null },
  }

  it('macrosSchema exige kcal y admite null (nunca undefined) en el resto', () => {
    expect(
      macrosSchema.parse({ kcal: 100, protein: null, carbs: null, fat: null }).protein,
    ).toBeNull()
    expect(() =>
      macrosSchema.parse({ kcal: 100, protein: undefined, carbs: null, fat: null }),
    ).toThrow()
    expect(() => macrosSchema.parse({ protein: 10, carbs: null, fat: null })).toThrow()
  })

  it('foodEntrySchema exige una cantidad positiva', () => {
    expect(() => foodEntrySchema.parse(entry)).not.toThrow()
    expect(() => foodEntrySchema.parse({ ...entry, amount: 0 })).toThrow()
  })

  it('nutritionDaySchema guarda el objetivo del día y las entradas', () => {
    const parsed = nutritionDaySchema.parse({
      dateKey: '2026-09-08',
      goal: { kcal: 1850, protein: 100, carbs: null, fat: null },
      entries: [entry],
      updatedAt: Timestamp.now(),
    })
    expect(parsed.entries).toHaveLength(1)
    expect(parsed.goal.kcal).toBe(1850)
  })

  it('los perfiles antiguos sin nutritionGoal parsean con null', () => {
    const parsed = userSettingsSchema.parse({
      theme: 'system',
      restTimer: { enabled: true, defaultSeconds: 90 },
      oneRmFormula: 'epley',
    })
    expect(parsed.nutritionGoal).toBeNull()
  })
})
