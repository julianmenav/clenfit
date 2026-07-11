import { addDoc, setDoc, Timestamp } from 'firebase/firestore'
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

export function updateCustomExercise(
  uid: string,
  id: string,
  data: CustomExerciseInput,
  createdAt: Timestamp,
): Promise<void> {
  return setDoc(customExerciseDoc(uid, id), { id, ...data, createdAt })
}
