import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/*
 * `queue` drives the full-screen overlay (ephemeral, not persisted).
 * `firedIds` per workout IS persisted: a mid-session reload must not refire
 * the same reminders. A new workout id resets the fired set.
 */
interface RemindersState {
  queue: string[]
  workoutId: string | null
  firedIds: string[]

  enqueue: (workoutId: string, firedIds: string[], messages: string[]) => void
  dismissCurrent: () => void
  /** Forget the session's fired set (queue untouched: a finish message may be showing). */
  resetSession: () => void
}

export const useRemindersStore = create<RemindersState>()(
  persist(
    (set, get) => ({
      queue: [],
      workoutId: null,
      firedIds: [],

      enqueue: (workoutId, firedIds, messages) => {
        const prev = get()
        const sameSession = prev.workoutId === workoutId
        set({
          workoutId,
          firedIds: sameSession ? [...prev.firedIds, ...firedIds] : firedIds,
          queue: [...prev.queue, ...messages],
        })
      },

      dismissCurrent: () => set((s) => ({ queue: s.queue.slice(1) })),

      resetSession: () => set({ workoutId: null, firedIds: [] }),
    }),
    {
      name: 'clenfit:reminders',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ workoutId: s.workoutId, firedIds: s.firedIds }) as RemindersState,
    },
  ),
)
