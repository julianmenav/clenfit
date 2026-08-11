import type { MuscleGroup, Reminder, WithId } from './types'

export type ReminderEvent =
  | { kind: 'workoutStart' }
  | { kind: 'workoutFinish' }
  | { kind: 'exerciseTouched'; exerciseId: string; muscle: MuscleGroup }

export interface ReminderContext {
  routineId: string | null
  /** Reminder ids already fired this session (each fires at most once). */
  firedIds: ReadonlySet<string>
}

/** Reminders that should fire for an event, honoring enabled/dedupe/routine filter. */
export function matchReminders(
  reminders: WithId<Reminder>[],
  event: ReminderEvent,
  ctx: ReminderContext,
): WithId<Reminder>[] {
  return reminders.filter((r) => {
    if (!r.enabled || ctx.firedIds.has(r.id)) return false
    if (r.routineIds != null && (ctx.routineId == null || !r.routineIds.includes(ctx.routineId)))
      return false
    switch (event.kind) {
      case 'workoutStart':
        return r.trigger.type === 'workoutStart'
      case 'workoutFinish':
        return r.trigger.type === 'workoutFinish'
      case 'exerciseTouched':
        return (
          (r.trigger.type === 'beforeExercise' && r.trigger.exerciseId === event.exerciseId) ||
          (r.trigger.type === 'beforeMuscle' && r.trigger.muscle === event.muscle)
        )
    }
  })
}

/** rand ∈ [0,1) — injected by the caller so the function stays pure. */
export function pickMessage(messages: string[], rand: number): string | null {
  if (messages.length === 0) return null
  const clamped = Math.min(Math.max(rand, 0), 1 - Number.EPSILON)
  return messages[Math.floor(clamped * messages.length)]
}
