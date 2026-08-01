import { ArrowLeft } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

/**
 * Back control that pops the real history stack instead of jumping to a fixed
 * tab, so a screen reached from several places returns where the user came
 * from. `fallback` is only used on a cold entry (deep link, PWA shortcut,
 * reload), which react-router signals with the default location key.
 */
export function BackButton({ fallback }: { fallback: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation('common')

  return (
    <button
      type="button"
      aria-label={t('actions.back')}
      onClick={() => {
        if (location.key === 'default') navigate(fallback, { replace: true })
        else navigate(-1)
      }}
      className="flex size-10 shrink-0 items-center justify-center rounded-card text-ink-2 active:bg-surface-2"
    >
      <ArrowLeft className="size-5" />
    </button>
  )
}
