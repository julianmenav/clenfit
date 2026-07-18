import { doc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import type { CustomExercise } from '@/domain/types'
import { customExerciseDoc, customExercisesCol } from './converters'

export type CustomExerciseInput = Omit<CustomExercise, 'createdAt'>

/** Client-generated id, write not awaited: also works offline. */
export function createCustomExercise(uid: string, data: CustomExerciseInput): string {
  const ref = doc(customExercisesCol(uid))
  setDoc(ref, { id: ref.id, ...data, createdAt: Timestamp.now() }).catch((err) =>
    console.error('[createCustomExercise]', err),
  )
  return ref.id
}

/** Partial update; `{ deprecated: true }` doubles as the soft delete. */
export function updateCustomExercise(
  uid: string,
  id: string,
  data: Partial<CustomExerciseInput>,
): Promise<void> {
  return updateDoc(customExerciseDoc(uid, id), data)
}
