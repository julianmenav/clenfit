import {
  collection,
  doc,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import type { z } from 'zod'
import { db } from '@/lib/firebase'
import {
  customExerciseSchema,
  exerciseStatsSchema,
  routineSchema,
  workoutSchema,
  type WithId,
} from '@/domain/types'

/**
 * Firestore rejects `undefined` and here there are nested structures (sets
 * inside exercises): clean it deeply. Timestamps and other classes pass through as-is.
 */
function stripUndefinedDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUndefinedDeep)
  if (value !== null && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefinedDeep(v)]),
    )
  }
  return value
}

function converterFor<S extends z.ZodType<Record<string, unknown>>>(
  schema: S,
): FirestoreDataConverter<WithId<z.infer<S>>> {
  return {
    toFirestore(model: WithId<z.infer<S>>) {
      const { id: _id, ...data } = model
      return stripUndefinedDeep(schema.parse(data)) as DocumentData
    },
    fromFirestore(snap: QueryDocumentSnapshot) {
      return { id: snap.id, ...schema.parse(snap.data()) } as WithId<z.infer<S>>
    },
  }
}

export const workoutConverter = converterFor(workoutSchema)
export const exerciseStatsConverter = converterFor(exerciseStatsSchema)
export const routineConverter = converterFor(routineSchema)
export const customExerciseConverter = converterFor(customExerciseSchema)

// Typed refs — everything lives under users/{uid}
export const workoutsCol = (uid: string) =>
  collection(db, 'users', uid, 'workouts').withConverter(workoutConverter)
export const workoutDoc = (uid: string, id: string) =>
  doc(db, 'users', uid, 'workouts', id).withConverter(workoutConverter)

export const exerciseStatsCol = (uid: string) =>
  collection(db, 'users', uid, 'exerciseStats').withConverter(exerciseStatsConverter)
export const exerciseStatsDoc = (uid: string, exerciseId: string) =>
  doc(db, 'users', uid, 'exerciseStats', exerciseId).withConverter(exerciseStatsConverter)

export const routinesCol = (uid: string) =>
  collection(db, 'users', uid, 'routines').withConverter(routineConverter)
export const routineDoc = (uid: string, id: string) =>
  doc(db, 'users', uid, 'routines', id).withConverter(routineConverter)

export const customExercisesCol = (uid: string) =>
  collection(db, 'users', uid, 'customExercises').withConverter(customExerciseConverter)
export const customExerciseDoc = (uid: string, id: string) =>
  doc(db, 'users', uid, 'customExercises', id).withConverter(customExerciseConverter)

export const userDoc = (uid: string) => doc(db, 'users', uid)
