import { Link, useRouteError } from 'react-router'
import { useTranslation } from 'react-i18next'

export function RouteError() {
  const error = useRouteError()
  const { t } = useTranslation()
  console.error('[route]', error)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">{t('error.title')}</h1>
      <p className="text-ink-2">{t('error.generic')}</p>
      <Link to="/" className="text-accent underline underline-offset-4">
        {t('actions.back')}
      </Link>
    </div>
  )
}
