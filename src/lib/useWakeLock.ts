import { useEffect } from 'react'

/**
 * Keeps the screen on while `active` (unsupported browsers — iOS < 16.4 —
 * degrade silently). The OS releases the lock on background: it must be
 * reacquired when the tab becomes visible again.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = () => {
      navigator.wakeLock
        .request('screen')
        .then((s) => {
          sentinel = s
          if (cancelled) void s.release()
        })
        .catch(() => {
          // denied (low battery / energy saver): not critical
        })
    }

    acquire()
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release()
    }
  }, [active])
}
