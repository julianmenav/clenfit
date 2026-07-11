import { useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { beep } from '@/lib/beep'
import { useRestTimerStore } from '@/store/restTimer'

/** Watches for the end of rest from any screen (toast + vibration + beep). */
export function RestTimerWatcher() {
  const endsAt = useRestTimerStore((s) => s.endsAt)
  const stop = useRestTimerStore((s) => s.stop)
  const { t } = useTranslation('workout')

  useEffect(() => {
    if (!endsAt) return
    const fire = () => {
      stop()
      toast(t('rest.done'))
      navigator.vibrate?.([200, 100, 200])
      beep()
    }
    const delay = endsAt - Date.now()
    if (delay <= 0) {
      // already expired (e.g. the app was closed): clear it without fanfare
      stop()
      return
    }
    const id = setTimeout(fire, delay)
    return () => clearTimeout(id)
  }, [endsAt, stop, t])

  return null
}
