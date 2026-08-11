import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRemindersStore } from '@/store/reminders'
import { cn } from '@/lib/utils'

/** Full-screen takeover: the message punches in word by word; tap to dismiss. */
export function ReminderOverlay() {
  const message = useRemindersStore((s) => s.queue[0] ?? null)
  const dismissCurrent = useRemindersStore((s) => s.dismissCurrent)
  const { t } = useTranslation('reminders')

  useEffect(() => {
    if (!message) return
    navigator.vibrate?.([80, 40, 120])
    // the keyboard must not sit on top of the takeover
    ;(document.activeElement as HTMLElement | null)?.blur?.()
  }, [message])

  if (!message) return null
  const words = message.split(' ')

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('overlay.label')}
      onClick={dismissCurrent}
      className="fixed inset-0 z-[100] flex cursor-pointer select-none flex-col items-center justify-center gap-12 bg-black/95 px-8"
    >
      <p
        key={message}
        className="max-w-lg text-center text-4xl font-black uppercase leading-tight tracking-tight text-white"
      >
        {words.map((word, i) => (
          <span key={i}>
            <span
              className={cn('reminder-word inline-block', i === words.length - 1 && 'text-accent')}
              style={{ animationDelay: `${Math.min(i * 130, 2600)}ms` }}
            >
              {word}
            </span>{' '}
          </span>
        ))}
      </p>
      <span
        className="reminder-word text-sm text-white/50"
        style={{ animationDelay: `${Math.min(words.length * 130 + 400, 3200)}ms` }}
      >
        {t('overlay.dismiss')}
      </span>
    </div>
  )
}
