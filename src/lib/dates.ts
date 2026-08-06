import { addDays, addWeeks, format, parseISO, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'

/** Local day key 'YYYY-MM-DD' (not UTC: a workout at 23:59 belongs to that day). */
export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/** Monday key of the week containing `dateKey` (parsed as local midnight). */
export function weekStartKey(dateKey: string): string {
  return toDateKey(startOfWeek(parseISO(dateKey), { weekStartsOn: 1 }))
}

/** Sunday key of the week starting at the given Monday key. */
export function weekEndKey(weekStart: string): string {
  return toDateKey(addDays(parseISO(weekStart), 6))
}

export function addWeeksToKey(dateKey: string, weeks: number): string {
  return toDateKey(addWeeks(parseISO(dateKey), weeks))
}

/** «27 jul – 2 ago» for the Mon–Sun week starting at the given Monday key. */
export function formatWeekRange(weekStart: string): string {
  return `${formatShortDate(parseISO(weekStart))} – ${formatShortDate(parseISO(weekEndKey(weekStart)))}`
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
