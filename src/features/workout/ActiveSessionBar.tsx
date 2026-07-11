import { useNavigate } from 'react-router'
import { Dumbbell, TimerIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatClock } from '@/lib/dates'
import { useActiveWorkoutStore } from '@/store/activeWorkout'
import { remainingSeconds, useRestTimerStore } from '@/store/restTimer'
import { useTicker } from './useTicker'

/** Thin, persistent bar shown while a session is active (above the nav on mobile). */
export function ActiveSessionBar() {
  const workout = useActiveWorkoutStore((s) => s.workout)
  const endsAt = useRestTimerStore((s) => s.endsAt)
  const navigate = useNavigate()
  const { t } = useTranslation('workout')
  useTicker(1000, workout != null)

  if (!workout) return null

  const elapsed = Math.max(0, Math.floor(Date.now() / 1000 - workout.startedAt.seconds))
  const rest = remainingSeconds(endsAt)

  return (
    <button
      type="button"
      onClick={() => navigate('/entrenamiento')}
      className="fixed inset-x-0 bottom-16 z-30 mx-auto flex h-12 w-full max-w-lg items-center gap-3 border-t border-hairline bg-surface-2/95 px-4 backdrop-blur lg:bottom-6 lg:left-auto lg:right-6 lg:w-80 lg:rounded-card lg:border"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      aria-label={t('resume.continue')}
    >
      <Dumbbell className="size-4 text-accent" />
      <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">{workout.name}</span>
      {rest > 0 && (
        <span className="tnum flex items-center gap-1 rounded-chip bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent">
          <TimerIcon className="size-3.5" />
          {formatClock(rest)}
        </span>
      )}
      <span className="tnum text-sm text-ink-2">{formatClock(elapsed)}</span>
    </button>
  )
}
