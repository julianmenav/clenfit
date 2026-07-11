import { Navigate, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from './AuthProvider'

function FullScreenLoader() {
  const { t } = useTranslation()
  return <div className="flex min-h-dvh items-center justify-center text-ink-3">{t('loading')}</div>
}

export function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  return user ? <Outlet /> : <Navigate to="/entrar" replace />
}

export function RedirectIfAuthed() {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  return user ? <Navigate to="/" replace /> : <Outlet />
}
