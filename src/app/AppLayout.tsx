import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { ChartPie, Dumbbell, History, House, Play, Settings } from 'lucide-react'
import { Toaster } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useActiveWorkout } from '@/data/hooks'
import { useActiveWorkoutStore } from '@/store/activeWorkout'
import { ActiveSessionBar } from '@/features/workout/ActiveSessionBar'
import { RestTimerWatcher } from '@/features/workout/RestTimerWatcher'
import { useStartWorkout } from '@/features/workout/useStartWorkout'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const { t } = useTranslation(['common', 'routines'])
  const location = useLocation()

  const tabs = [
    { to: '/', label: t('nav.home'), icon: House },
    { to: '/historial', label: t('nav.history'), icon: History },
    { to: '/ejercicios', label: t('nav.exercises'), icon: Dumbbell },
    { to: '/analisis', label: t('nav.analytics'), icon: ChartPie },
  ] as const

  const onWorkoutScreen = location.pathname === '/entrenamiento'

  // no scroll restoration: every screen starts at the top
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col lg:grid lg:max-w-[1600px] lg:grid-cols-[220px_1fr] lg:items-start lg:gap-10 lg:px-8">
      <RemoteWorkoutHydrator />
      <RestTimerWatcher />

      <main
        className="w-full flex-1 pb-28 lg:col-start-2 lg:row-start-1 lg:pb-10 lg:pt-4"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <Outlet />
      </main>

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--surface-2)',
            color: 'var(--ink)',
            border: '1px solid var(--hairline)',
          },
        }}
      />

      {!onWorkoutScreen && <ActiveSessionBar />}

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center">
          {tabs.slice(0, 2).map((tab) => (
            <TabLink key={tab.to} {...tab} />
          ))}

          <TrainFab />

          {tabs.slice(2).map((tab) => (
            <TabLink key={tab.to} {...tab} />
          ))}
        </div>
      </nav>

      {/* Desktop-only sidebar. Rendered AFTER the mobile nav so that on
          mobile the first matching nav link in the DOM is the visible one. */}
      <aside className="hidden lg:col-start-1 lg:row-start-1 lg:block">
        <div className="sticky top-0 flex h-dvh flex-col gap-1 py-10">
          <span className="pb-8 pl-3 text-xl font-bold">{t('appName')}</span>
          {tabs.map((tab) => (
            <SideLink key={tab.to} {...tab} />
          ))}
          <SideLink to="/rutinas" label={t('routines:title')} icon={Play} />
          <SideLink to="/ajustes" label={t('nav.settings')} icon={Settings} />
          <TrainSideButton />
        </div>
      </aside>
    </div>
  )
}

/** Adopts the active Firestore doc if the local store is empty (another device / reinstall). */
function RemoteWorkoutHydrator() {
  const remote = useActiveWorkout()
  const hydrate = useActiveWorkoutStore((s) => s.hydrateFromRemote)

  useEffect(() => {
    if (remote !== undefined) hydrate(remote)
  }, [remote, hydrate])

  return null
}

function TrainFab() {
  const { t } = useTranslation()
  const { starting, startAndGo } = useStartWorkout()

  return (
    <div className="flex justify-center">
      <button
        type="button"
        aria-label={t('nav.train')}
        disabled={starting}
        onClick={() => void startAndGo()}
        className="-mt-6 flex size-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg transition-transform active:scale-95 disabled:opacity-60"
      >
        <Play className="size-7" strokeWidth={2.5} />
      </button>
    </div>
  )
}

function TrainSideButton() {
  const { t } = useTranslation()
  const { starting, startAndGo } = useStartWorkout()

  return (
    <button
      type="button"
      disabled={starting}
      onClick={() => void startAndGo()}
      className="mt-6 flex h-11 items-center justify-center gap-2 rounded-card bg-accent font-semibold text-on-accent transition-transform active:scale-[0.98] disabled:opacity-60"
    >
      <Play className="size-5" strokeWidth={2.5} />
      {t('nav.train')}
    </button>
  )
}

function SideLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof House }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex h-11 items-center gap-3 rounded-chip px-3 text-[15px]',
          isActive ? 'bg-surface-2 font-medium text-accent' : 'text-ink-2 hover:bg-surface',
        )
      }
    >
      <Icon className="size-5" />
      {label}
    </NavLink>
  )
}

function TabLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof House }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'flex h-full flex-col items-center justify-center gap-0.5',
          isActive ? 'text-accent' : 'text-ink-3',
        )
      }
    >
      <Icon className="size-6" />
      <span className="text-[11px] leading-none">{label}</span>
    </NavLink>
  )
}
