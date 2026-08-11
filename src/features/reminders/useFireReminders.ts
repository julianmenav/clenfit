import { useReminders } from '@/data/hooks'
import { matchReminders, pickMessage, type ReminderEvent } from '@/domain/reminders'
import { useRemindersStore } from '@/store/reminders'

/** Evaluates an event against the user's reminders and queues the overlay. */
export function useFireReminders() {
  const reminders = useReminders()

  return function fire(event: ReminderEvent, workout: { id: string; routineId: string | null }) {
    if (!reminders?.length) return
    const state = useRemindersStore.getState()
    const firedIds = new Set(state.workoutId === workout.id ? state.firedIds : [])
    const matched = matchReminders(reminders, event, { routineId: workout.routineId, firedIds })
    if (matched.length === 0) return
    const messages = matched
      .map((r) => pickMessage(r.messages, Math.random()))
      .filter((m): m is string => m != null)
    state.enqueue(
      workout.id,
      matched.map((r) => r.id),
      messages,
    )
  }
}
