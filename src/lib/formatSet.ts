import type { Measurement, SetEntry } from '@/domain/types'
import { formatClock } from './dates'

/** '62,5' — no extra zeros, Spanish decimal comma. */
export function formatKg(value: number): string {
  return (Math.round(value * 100) / 100).toString().replace('.', ',')
}

export function formatKm(meters: number): string {
  return (Math.round(meters / 10) / 100).toString().replace('.', ',')
}

/** Compact summary of a set: '60 kg × 8', '12 reps', '1:30', '2,5 km · 12:00'. */
export function formatSet(set: SetEntry, measurement: Measurement): string {
  switch (measurement) {
    case 'weight_reps':
      if (set.weightKg == null && set.reps == null) return '—'
      return `${set.weightKg != null ? `${formatKg(set.weightKg)} kg` : '—'} × ${set.reps ?? '—'}`
    case 'reps_only':
      return set.reps != null ? `${set.reps} reps` : '—'
    case 'time_only':
      return set.durationSeconds != null ? formatClock(set.durationSeconds) : '—'
    case 'weight_time':
      if (set.weightKg == null && set.durationSeconds == null) return '—'
      return `${set.weightKg != null ? `${formatKg(set.weightKg)} kg` : '—'} · ${
        set.durationSeconds != null ? formatClock(set.durationSeconds) : '—'
      }`
    case 'distance_time':
      if (set.distanceMeters == null && set.durationSeconds == null) return '—'
      return `${set.distanceMeters != null ? `${formatKm(set.distanceMeters)} km` : '—'} · ${
        set.durationSeconds != null ? formatClock(set.durationSeconds) : '—'
      }`
  }
}

/** '1:30' or '90' → seconds. null if it can't be parsed. */
export function parseTimeToSeconds(text: string): number | null {
  const clean = text.trim()
  if (!clean) return null
  if (clean.includes(':')) {
    const [m, s] = clean.split(':')
    const min = Number(m)
    const sec = Number(s)
    if (!Number.isFinite(min) || !Number.isFinite(sec)) return null
    return min * 60 + sec
  }
  const n = Number(clean.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

/** '2,5' (km) → meters. */
export function parseKmToMeters(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) : null
}

export function parseDecimal(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function parseInteger(text: string): number | null {
  const n = Number(text.trim())
  return Number.isInteger(n) && n >= 0 ? n : null
}
