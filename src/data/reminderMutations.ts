import { deleteDoc, doc, setDoc, Timestamp } from 'firebase/firestore'
import type { Reminder, WithId } from '@/domain/types'
import { reminderDoc, remindersCol } from './converters'

/** Creates a reminder (offline-safe: the write is not awaited). */
export function createReminder(uid: string, data: Omit<Reminder, 'createdAt'>): string {
  const ref = doc(remindersCol(uid))
  const reminder: WithId<Reminder> = { id: ref.id, ...data, createdAt: Timestamp.now() }
  setDoc(ref, reminder).catch((err) => console.error('[createReminder]', err))
  return ref.id
}

export function saveReminder(uid: string, reminder: WithId<Reminder>): void {
  setDoc(reminderDoc(uid, reminder.id), reminder).catch((err) =>
    console.error('[saveReminder]', err),
  )
}

export function deleteReminder(uid: string, id: string): void {
  deleteDoc(reminderDoc(uid, id)).catch((err) => console.error('[deleteReminder]', err))
}
