import { addDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import type { Routine, RoutineSlot, WithId } from '@/domain/types'
import { routineDoc, routinesCol } from './converters'

export interface RoutineInput {
  name: string
  slots: RoutineSlot[]
}

export async function createRoutine(uid: string, input: RoutineInput): Promise<string> {
  const routine: Routine = {
    name: input.name,
    order: Date.now(),
    archived: false,
    slots: input.slots,
    lastPerformedAt: null,
    timesPerformed: 0,
    createdAt: Timestamp.now(),
  }
  const ref = await addDoc(routinesCol(uid), { id: '', ...routine })
  return ref.id
}

export function updateRoutine(uid: string, existing: WithId<Routine>, input: RoutineInput) {
  return setDoc(routineDoc(uid, existing.id), {
    ...existing,
    name: input.name,
    slots: input.slots,
  })
}

/** «Eliminar» = archivar: el historial de sesiones sigue apuntando a ella. */
export function archiveRoutine(uid: string, id: string): Promise<void> {
  return updateDoc(routineDoc(uid, id), { archived: true })
}
