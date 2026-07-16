import { addDoc, Timestamp, updateDoc } from 'firebase/firestore'
import type { CustomExercise } from '@/domain/types'
import { customExerciseDoc, customExercisesCol } from './converters'

export type CustomExerciseInput = Omit<CustomExercise, 'createdAt'>

export async function createCustomExercise(
  uid: string,
  data: CustomExerciseInput,
): Promise<string> {
  const ref = await addDoc(customExercisesCol(uid), {
    id: '',
    ...data,
    createdAt: Timestamp.now(),
  })
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
