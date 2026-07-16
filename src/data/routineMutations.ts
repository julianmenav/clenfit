import { doc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import type { Routine, RoutineSlot, WithId } from '@/domain/types'
import { routineDoc, routinesCol } from './converters'

export interface RoutineInput {
  name: string
  slots: RoutineSlot[]
}

/** Client-generated id, write not awaited: also works offline. */
export function createRoutine(uid: string, input: RoutineInput): string {
  const routine: Routine = {
    name: input.name,
    order: Date.now(),
    archived: false,
    slots: input.slots,
    lastPerformedAt: null,
    timesPerformed: 0,
    createdAt: Timestamp.now(),
  }
  const ref = doc(routinesCol(uid))
  setDoc(ref, { id: ref.id, ...routine }).catch((err) => console.error('[createRoutine]', err))
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
