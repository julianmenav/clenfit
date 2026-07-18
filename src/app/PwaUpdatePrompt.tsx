import { useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_MS = 60 * 60 * 1000

/** SW registration + «nueva versión» toast (the user decides when to reload). */
export function PwaUpdatePrompt() {
  const { t } = useTranslation()
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => void registration.update(), UPDATE_CHECK_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update()
      })
    },
  })

  useEffect(() => {
    if (!offlineReady) return
    toast.message(t('pwa.offlineReady'))
    setOfflineReady(false)
  }, [offlineReady, setOfflineReady, t])

  useEffect(() => {
    if (!needRefresh) return
    toast(t('pwa.updateAvailable'), {
      id: 'pwa-update',
      duration: Infinity,
      action: {
        label: t('pwa.updateAction'),
        onClick: () => void updateServiceWorker(true),
      },
    })
  }, [needRefresh, t, updateServiceWorker])

  return null
}
