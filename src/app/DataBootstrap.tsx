import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useUser } from './AuthProvider'
import { ensureUserSeeded } from '@/data/seedDefaults'
import { applyThemePref } from '@/lib/theme'
import { useUserProfile } from '@/data/hooks'

/** Prepara la cuenta (perfil con ajustes) antes de mostrar la app. */
export function DataBootstrap() {
  const user = useUser()
  const { t } = useTranslation()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ensureUserSeeded(user)
      .catch((err) => console.error('[bootstrap]', err))
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-ink-3">{t('loading')}</div>
    )
  }
  return <ThemeSync />
}

/** El tema guardado en el perfil manda (localStorage solo evita el flash inicial). */
function ThemeSync() {
  const profile = useUserProfile()
  const theme = profile?.settings.theme

  useEffect(() => {
    if (theme) applyThemePref(theme)
  }, [theme])

  return <Outlet />
}
