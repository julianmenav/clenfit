import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/** Local day key 'YYYY-MM-DD' (not UTC: a workout at 23:59 belongs to that day). */
export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function formatDay(date: Date): string {
  const s = format(date, "EEEE d 'de' MMMM", { locale: es })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatShortDate(date: Date): string {
  return format(date, 'd MMM', { locale: es })
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (h > 0) return `${h} h ${m} min`
  return `${m} min`
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
