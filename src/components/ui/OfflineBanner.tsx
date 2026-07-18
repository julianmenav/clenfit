import { useEffect, useRef } from 'react'
import { CloudOff } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useOnline } from '@/lib/useOnline'

/** Slim global strip while offline + a one-off toast on reconnect. */
export function OfflineBanner() {
  const { t } = useTranslation()
  const online = useOnline()
  const wasOffline = useRef(false)

  useEffect(() => {
    if (!online) {
      wasOffline.current = true
    } else if (wasOffline.current) {
      wasOffline.current = false
      toast.message(t('net.backOnline'))
    }
  }, [online, t])

  if (online) return null

  return (
    <div
      role="status"
      className="sticky z-50 flex items-center justify-center gap-2 rounded-b-card bg-surface-2 py-1.5 text-xs text-ink-2"
      style={{ top: 'env(safe-area-inset-top)' }}
    >
      <CloudOff className="size-3.5" />
      {t('net.offline')}
    </div>
  )
}
