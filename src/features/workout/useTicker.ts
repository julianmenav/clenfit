import { useEffect, useState } from 'react'

/** Periodic re-render for counters (elapsed, rest). */
export function useTicker(intervalMs = 1000, enabled = true): number {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setTick((t) => t + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, enabled])
  return Date.now()
}
