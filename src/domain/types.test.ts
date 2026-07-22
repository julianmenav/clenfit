import { describe, expect, it } from 'vitest'
import { workoutExerciseSchema } from './types'

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
