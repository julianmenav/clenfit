import { Link } from 'react-router'
import { ClipboardList, Pencil, Play, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/ui/EmptyState'
import { useRoutines } from '@/data/hooks'
import { formatShortDate } from '@/lib/dates'
import { useActiveWorkoutStore } from '@/store/activeWorkout'
import { useStartWorkout } from '@/features/workout/useStartWorkout'

export function RoutinesScreen() {
  const { t } = useTranslation(['routines', 'common'])
  const routines = useRoutines()
  const active = useActiveWorkoutStore((s) => s.workout)
  const { startAndGo, starting } = useStartWorkout()

  if (routines === undefined) {
    return <p className="px-4 pt-10 text-center text-ink-3">{t('common:loading')}</p>
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('routines:title')}</h1>
        <Link
          to="/rutinas/nueva"
          aria-label={t('routines:new')}
          className="flex size-10 items-center justify-center rounded-card bg-surface-2 text-ink"
        >
          <Plus className="size-5" />
        </Link>
      </header>

      {routines.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t('routines:title')}
          body={t('routines:empty')}
          action={
            <Link
              to="/rutinas/nueva"
              className="mt-1 flex h-10 items-center rounded-card bg-accent px-4 text-sm font-semibold text-on-accent"
            >
              {t('routines:new')}
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {routines.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 rounded-card border border-hairline bg-surface p-3"
            >
              <Link to={`/rutinas/${r.id}`} className="min-w-0 flex-1">
                <h2 className="truncate font-semibold">{r.name}</h2>
                <p className="mt-0.5 text-xs text-ink-3">
                  {t('routines:exercises', { count: r.slots.length })}
                  {' · '}
                  {r.lastPerformedAt
                    ? t('routines:lastPerformed', {
                        date: formatShortDate(r.lastPerformedAt.toDate()),
                      })
                    : t('routines:neverPerformed')}
                </p>
              </Link>
              <Link
                to={`/rutinas/${r.id}`}
                aria-label={t('routines:edit')}
                className="flex size-10 items-center justify-center rounded-card text-ink-3 active:bg-surface-2"
              >
                <Pencil className="size-4" />
              </Link>
              <button
                type="button"
                disabled={active != null || starting}
                onClick={() => void startAndGo(r)}
                className="flex h-10 items-center gap-1.5 rounded-card bg-accent px-3.5 text-sm font-semibold text-on-accent disabled:opacity-50"
              >
                <Play className="size-4" />
                {t('routines:start')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
