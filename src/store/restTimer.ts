import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/*
 * Stores the end instant (epoch ms), never a countdown: navigating, suspending
 * the tab, or reopening the app always shows the real remaining time.
 */
interface RestTimerState {
  endsAt: number | null
  totalSeconds: number

  start: (seconds: number) => void
  extend: (deltaSeconds: number) => void
  stop: () => void
}

export const useRestTimerStore = create<RestTimerState>()(
  persist(
    (set, get) => ({
      endsAt: null,
      totalSeconds: 0,

      start: (seconds) => set({ endsAt: Date.now() + seconds * 1000, totalSeconds: seconds }),

      extend: (deltaSeconds) => {
        const { endsAt, totalSeconds } = get()
        if (!endsAt) return
        const next = Math.max(Date.now() + 1000, endsAt + deltaSeconds * 1000)
        set({ endsAt: next, totalSeconds: Math.max(1, totalSeconds + deltaSeconds) })
      },

      stop: () => set({ endsAt: null, totalSeconds: 0 }),
    }),
    { name: 'clenfit:restTimer' },
  ),
)

/** Remaining seconds (0 if there is no timer). */
export function remainingSeconds(endsAt: number | null): number {
  if (!endsAt) return 0
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
}
