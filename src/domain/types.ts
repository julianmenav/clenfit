import { Timestamp } from 'firebase/firestore'
import { z } from 'zod'

export type WithId<T> = T & { id: string }

/* ---------------------------------- Enums --------------------------------- */

export const muscleGroups = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'cardio',
] as const
export type MuscleGroup = (typeof muscleGroups)[number]

export const equipmentTypes = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'kettlebell',
  'bodyweight',
  'band',
  'smith',
  'cardio_machine',
  'other',
] as const
export type Equipment = (typeof equipmentTypes)[number]

/** Decides which fields a set of this exercise records. */
export const measurementTypes = [
  'weight_reps',
  'reps_only',
  'time_only',
  'weight_time',
  'distance_time',
] as const
export type Measurement = (typeof measurementTypes)[number]

/** Movement pattern: the axis that makes similar-exercise suggestions useful. */
export const movements = [
  'horizontal_press',
  'incline_press',
  'decline_press',
  'chest_fly',
  'chest_dip',
  'row',
  'vertical_pull',
  'pullover',
  'back_extension',
  'overhead_press',
  'lateral_raise',
  'front_raise',
  'rear_delt',
  'shrug',
  'curl',
  'triceps_extension',
  'triceps_pushdown',
  'forearm',
  'squat_pattern',
  'hinge',
  'lunge',
  'leg_extension',
  'leg_curl',
  'hip_thrust',
  'abduction',
  'adduction',
  'calf_raise',
  'ab_flexion',
  'ab_rotation',
  'plank_hold',
  'carry',
  'cardio_steady',
  'cardio_interval',
  'other',
] as const
export type Movement = (typeof movements)[number]

export const setTypes = ['normal', 'warmup', 'dropset', 'failure'] as const
export type SetType = (typeof setTypes)[number]

export const oneRmFormulas = ['epley', 'brzycki'] as const
export type OneRmFormula = (typeof oneRmFormulas)[number]

/* ------------------------------ Exercise defs ----------------------------- */

export interface ExerciseDef {
  id: string
  name: string
  muscle: MuscleGroup
  secondaryMuscles?: MuscleGroup[]
  equipment: Equipment
  movement: Movement
  measurement: Measurement
  aliases?: string[]
  deprecated?: boolean
  /** true = created by the user (lives in Firestore, not in the catalog) */
  custom?: boolean
}

export const customExerciseSchema = z.object({
  name: z.string().min(1),
  muscle: z.enum(muscleGroups),
  secondaryMuscles: z.array(z.enum(muscleGroups)).optional(),
  equipment: z.enum(equipmentTypes),
  movement: z.enum(movements),
  measurement: z.enum(measurementTypes),
  deprecated: z.boolean().optional(),
  createdAt: z.instanceof(Timestamp),
})
export type CustomExercise = z.infer<typeof customExerciseSchema>

/* --------------------------------- Workouts ------------------------------- */

/*
 * Missing measurement fields = null (never undefined: Firestore rejects it and
 * sets are nested in arrays where you can't filter on write).
 */
export const setEntrySchema = z.object({
  order: z.number().int(),
  type: z.enum(setTypes),
  weightKg: z.number().nullable(),
  reps: z.number().int().nullable(),
  durationSeconds: z.number().nullable(),
  distanceMeters: z.number().nullable(),
  rpe: z.number().min(6).max(10).nullable(),
  completed: z.boolean(),
})
export type SetEntry = z.infer<typeof setEntrySchema>

export const workoutExerciseSchema = z.object({
  exerciseId: z.string(),
  /** Copy of the name: survives renames and retired exercises. */
  exerciseName: z.string(),
  muscle: z.enum(muscleGroups),
  measurement: z.enum(measurementTypes),
  order: z.number().int(),
  /** Routine slot it occupies; allows proposing an update after a change. */
  slotIndex: z.number().int().nullable(),
  swappedFrom: z.string().nullable(),
  restSeconds: z.number().int().nullable(),
  /** Session note for this exercise. Defaulted so docs written before the field parse. */
  notes: z.string().nullable().default(null),
  sets: z.array(setEntrySchema),
})
export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>

export const workoutSchema = z.object({
  status: z.enum(['active', 'completed']),
  name: z.string(),
  routineId: z.string().nullable(),
  startedAt: z.instanceof(Timestamp),
  completedAt: z.instanceof(Timestamp).nullable(),
  durationSeconds: z.number().int().nullable(),
  dateKey: z.string(),
  notes: z.string().nullable(),
  /** Redundant with exercises[].exerciseId: makes array-contains + orderBy possible. */
  exerciseIds: z.array(z.string()),
  exercises: z.array(workoutExerciseSchema),
  // Summary computed on finish (avoids iterating sets in listings)
  totalVolumeKg: z.number().nullable(),
  totalSets: z.number().int().nullable(),
  prCount: z.number().int().nullable(),
  setsByMuscle: z.record(z.string(), z.number()).nullable(),
})
export type Workout = z.infer<typeof workoutSchema>

/* ----------------------------- Exercise stats ----------------------------- */

export const prRecordSchema = z.object({
  value: z.number(),
  workoutId: z.string(),
  dateKey: z.string(),
})
export type PrRecord = z.infer<typeof prRecordSchema>

export const prTypes = [
  'heaviestWeightKg',
  'best1RmEpley',
  'best1RmBrzycki',
  'bestSetVolumeKg',
  'bestSessionVolumeKg',
  'mostReps',
] as const
export type PrType = (typeof prTypes)[number]

export const exerciseStatsSchema = z.object({
  exerciseId: z.string(),
  exerciseName: z.string(),
  /** Sets from the last session: feeds the ghost values while logging. */
  lastPerformance: z
    .object({
      workoutId: z.string(),
      dateKey: z.string(),
      sets: z.array(setEntrySchema),
    })
    .nullable(),
  prs: z.partialRecord(z.enum(prTypes), prRecordSchema),
  totalSessions: z.number().int(),
  updatedAt: z.instanceof(Timestamp),
})
export type ExerciseStats = z.infer<typeof exerciseStatsSchema>

/* --------------------------------- Routines ------------------------------- */

export const routineSlotSchema = z.object({
  exerciseId: z.string(),
  exerciseName: z.string(),
  order: z.number().int(),
  targetSets: z.number().int().nullable(),
  targetReps: z.string().nullable(),
  restSeconds: z.number().int().nullable(),
})
export type RoutineSlot = z.infer<typeof routineSlotSchema>

export const routineSchema = z.object({
  name: z.string().min(1),
  order: z.number().int(),
  archived: z.boolean(),
  slots: z.array(routineSlotSchema),
  lastPerformedAt: z.instanceof(Timestamp).nullable(),
  timesPerformed: z.number().int(),
  createdAt: z.instanceof(Timestamp),
})
export type Routine = z.infer<typeof routineSchema>

/* ------------------------------- User profile ----------------------------- */

export const userSettingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  restTimer: z.object({
    enabled: z.boolean(),
    defaultSeconds: z.number().int(),
  }),
  oneRmFormula: z.enum(oneRmFormulas),
})
export type UserSettings = z.infer<typeof userSettingsSchema>

export const userProfileSchema = z.object({
  displayName: z.string().nullable(),
  locale: z.string(),
  createdAt: z.instanceof(Timestamp),
  settings: userSettingsSchema,
})
export type UserProfile = z.infer<typeof userProfileSchema>

export const defaultSettings: UserSettings = {
  theme: 'system',
  restTimer: { enabled: true, defaultSeconds: 90 },
  oneRmFormula: 'epley',
}
