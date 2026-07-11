import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatClock } from '@/lib/dates'
import { remainingSeconds, useRestTimerStore } from '@/store/restTimer'
import { useTicker } from './useTicker'

/** Rest countdown within the workout screen. */
export function RestTimerBar() {
  const endsAt = useRestTimerStore((s) => s.endsAt)
  const totalSeconds = useRestTimerStore((s) => s.totalSeconds)
  const extend = useRestTimerStore((s) => s.extend)
  const stop = useRestTimerStore((s) => s.stop)
  const { t } = useTranslation('workout')
  useTicker(250, endsAt != null)

  if (!endsAt) return null
  const remaining = remainingSeconds(endsAt)
  const progress = totalSeconds > 0 ? remaining / totalSeconds : 0

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-3 border-b border-hairline bg-surface/95 px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-ink-2">{t('rest.title')}</span>
        <span className="tnum flex-1 text-center text-2xl font-bold">{formatClock(remaining)}</span>
        <button type="button" onClick={() => extend(-30)} className="h-9 rounded-chip bg-surface-2 px-3 text-sm font-semibold">
          −30
        </button>
        <button type="button" onClick={() => extend(30)} className="h-9 rounded-chip bg-surface-2 px-3 text-sm font-semibold">
          +30
        </button>
        <button
          type="button"
          onClick={stop}
          aria-label={t('rest.skip')}
          className="flex size-9 items-center justify-center rounded-chip bg-surface-2 text-ink-2"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}
